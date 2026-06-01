import { createAmazonProductDetailUrl, resolveAmazonMarketplace } from '../../config/amazon'
import {
  DELIVERY_DETAIL_BATCH_SIZE,
  DELIVERY_DETAIL_ITEM_STATUS,
  DELIVERY_DETAIL_PHASE,
  DELIVERY_DETAIL_POLL_INTERVAL_MS,
  DELIVERY_DETAIL_RISK_CONTROL_COOLDOWN_MS
} from '../../config/crawler'
import type { AmazonMarketplace } from '../../types/amazon'
import type {
  CrawlerProgressHandler,
  DeliveryDetailQueueItem,
  DeliveryDetailState
} from '../../types/crawler'
import type {
  PendingDeliveryDetailProduct,
  ProductDeliveryDetailUpdate
} from '../../types/database'
import type { CrawlingSettings } from '../../../shared/settings'
import { getErrorMessage, isAbortError, throwIfAborted } from '../../utils/error'
import { sleep } from '../../utils/time'
import { databaseService } from '../database.service'
import { amazonClient } from './amazon-client'
import { parseAmazonDeliveryDetailHtml } from './delivery-parser'
import { AmazonRiskControlError } from './errors'

interface DeliveryDetailCrawlerOptions {
  taskId: number
  marketplace: AmazonMarketplace
  cookies: string
  signal?: AbortSignal
  isSourceComplete: () => boolean
  onProgress: CrawlerProgressHandler
}

interface DeliveryDetailResult {
  update?: ProductDeliveryDetailUpdate
  failedProductId?: number
}

type StateChangeHandler = (state: DeliveryDetailState) => void

function createInitialState(concurrency: number): DeliveryDetailState {
  return {
    phase: DELIVERY_DETAIL_PHASE.IDLE,
    batchSize: DELIVERY_DETAIL_BATCH_SIZE,
    concurrency,
    batchNumber: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    waitingProductCount: 0,
    queue: []
  }
}

export class AmazonDeliveryDetailCrawler {
  private state = createInitialState(1)
  private readonly concurrencyChangeHandlers = new Set<() => void>()

  public constructor(private readonly onStateChange: StateChangeHandler) {}

  public getState(): DeliveryDetailState {
    return {
      ...this.state,
      queue: this.state.queue.map((item) => ({ ...item }))
    }
  }

  public reset(): void {
    this.state = createInitialState(this.state.concurrency)
    this.notifyStateChange()
  }

  public syncRuntimeSettings(settings: CrawlingSettings): boolean {
    const concurrency = Math.max(1, Math.floor(settings.concurrencyCount))
    if (this.state.concurrency === concurrency) return false

    this.state.concurrency = concurrency
    return true
  }

  public applyRuntimeSettings(settings: CrawlingSettings): void {
    if (!this.syncRuntimeSettings(settings)) return

    for (const handleConcurrencyChange of this.concurrencyChangeHandlers) {
      handleConcurrencyChange()
    }
    this.notifyStateChange()
  }

  public markIdle(): void {
    this.state.phase = DELIVERY_DETAIL_PHASE.IDLE
    this.notifyStateChange()
  }

  public stop(): void {
    this.state.phase = DELIVERY_DETAIL_PHASE.STOPPING
    this.notifyStateChange()
  }

  public fail(error: unknown): void {
    this.state.phase = DELIVERY_DETAIL_PHASE.FAILED
    this.state.lastError = getErrorMessage(error)
    this.notifyStateChange()
  }

  public async run({
    taskId,
    marketplace,
    cookies,
    signal,
    isSourceComplete,
    onProgress
  }: DeliveryDetailCrawlerOptions): Promise<void> {
    const deferredProductIds = new Set<number>()
    this.setPhase(DELIVERY_DETAIL_PHASE.WAITING)
    onProgress(
      `[详情] 配送天数采集器已启动：每批 ${DELIVERY_DETAIL_BATCH_SIZE} 个商品，并发数 ${this.state.concurrency}。`
    )

    while (true) {
      throwIfAborted(signal)
      const batch = databaseService.queryPendingDeliveryDetails(
        taskId,
        DELIVERY_DETAIL_BATCH_SIZE,
        deferredProductIds
      )
      this.updateWaitingProductCount(batch.length)

      if (batch.length < DELIVERY_DETAIL_BATCH_SIZE) {
        if (isSourceComplete()) {
          if (batch.length > 0) {
            onProgress(
              `[详情] 剩余 ${batch.length} 个未采集配送天数的商品，不足完整批次 ${DELIVERY_DETAIL_BATCH_SIZE}，按批处理规则暂不抓取。`
            )
          }
          this.setPhase(DELIVERY_DETAIL_PHASE.COMPLETED)
          return
        }

        await sleep(DELIVERY_DETAIL_POLL_INTERVAL_MS, signal)
        continue
      }

      try {
        await this.processBatch(batch, marketplace, cookies, deferredProductIds, onProgress, signal)
      } catch (error) {
        if (!(error instanceof AmazonRiskControlError)) throw error

        await this.waitForRiskControlCooldown(error, onProgress, signal)
      }
    }
  }

  private async processBatch(
    batch: PendingDeliveryDetailProduct[],
    marketplace: AmazonMarketplace,
    cookies: string,
    deferredProductIds: Set<number>,
    onProgress: CrawlerProgressHandler,
    signal?: AbortSignal
  ): Promise<void> {
    this.state.batchNumber++
    this.state.phase = DELIVERY_DETAIL_PHASE.RUNNING
    this.state.waitingProductCount = 0
    this.state.queue = batch.map((product) => ({
      productId: product.id,
      asin: product.asin,
      title: product.title,
      status: DELIVERY_DETAIL_ITEM_STATUS.PENDING
    }))
    this.notifyStateChange()
    onProgress(
      `[详情] 启动第 ${this.state.batchNumber} 批配送天数采集，共 ${batch.length} 个商品。`
    )

    const results = await this.mapWithConcurrency(batch, async (product) => {
      const result = await this.fetchProductDetail(
        product,
        marketplace,
        cookies,
        onProgress,
        signal
      )
      return result
    })
    throwIfAborted(signal)

    const updates = results.flatMap((result) => (result.update ? [result.update] : []))
    const failedProductIds = results.flatMap((result) =>
      result.failedProductId === undefined ? [] : [result.failedProductId]
    )
    for (const productId of failedProductIds) deferredProductIds.add(productId)

    const affectedRows = databaseService.updateProductDeliveryDetails(updates)
    this.state.totalSucceeded += affectedRows
    this.state.totalFailed += failedProductIds.length
    this.setPhase(DELIVERY_DETAIL_PHASE.WAITING)
    onProgress(
      `[详情] 第 ${this.state.batchNumber} 批采集完成：成功回填 ${affectedRows} 个，网络失败 ${failedProductIds.length} 个。`
    )
  }

  private async fetchProductDetail(
    product: PendingDeliveryDetailProduct,
    marketplace: AmazonMarketplace,
    cookies: string,
    onProgress: CrawlerProgressHandler,
    signal?: AbortSignal
  ): Promise<DeliveryDetailResult> {
    this.updateQueueItem(product.id, { status: DELIVERY_DETAIL_ITEM_STATUS.FETCHING })

    try {
      const marketplaceConfig = resolveAmazonMarketplace(marketplace)
      const html = await amazonClient.fetchHtml(
        createAmazonProductDetailUrl(marketplaceConfig.baseUrl, product.asin),
        cookies,
        signal
      )
      throwIfAborted(signal)
      const { deliveryDays } = parseAmazonDeliveryDetailHtml(html, marketplace)
      this.updateQueueItem(product.id, {
        status: DELIVERY_DETAIL_ITEM_STATUS.SUCCESS,
        deliveryDays
      })

      return {
        update: {
          productId: product.id,
          deliveryDays
        }
      }
    } catch (error) {
      if (isAbortError(error)) throw error

      const message = getErrorMessage(error)
      this.updateQueueItem(product.id, {
        status: DELIVERY_DETAIL_ITEM_STATUS.FAILED,
        error: message
      })
      if (error instanceof AmazonRiskControlError) {
        onProgress(`[风控] 商品 ${product.asin} 详情请求被亚马逊限制: ${message}`)
        throw error
      }

      onProgress(`[详情] 商品 ${product.asin} 详情请求失败，稍后可重试: ${message}`)
      return { failedProductId: product.id }
    }
  }

  private async mapWithConcurrency<TItem, TResult>(
    items: TItem[],
    handler: (item: TItem) => Promise<TResult>
  ): Promise<TResult[]> {
    return await new Promise<TResult[]>((resolve, reject) => {
      const results = new Array<TResult>(items.length)
      let nextIndex = 0
      let activeCount = 0
      let settled = false
      let firstError: unknown
      let hasError = false

      const finish = (): void => {
        this.concurrencyChangeHandlers.delete(schedule)
      }

      const settleIfComplete = (): void => {
        if (activeCount > 0) return

        if (hasError) {
          settled = true
          finish()
          reject(firstError)
        } else if (nextIndex >= items.length) {
          settled = true
          finish()
          resolve(results)
        }
      }

      const schedule = (): void => {
        if (settled) return

        while (!hasError && activeCount < this.state.concurrency && nextIndex < items.length) {
          const currentIndex = nextIndex++
          activeCount++

          void handler(items[currentIndex]).then(
            (result) => {
              results[currentIndex] = result
              activeCount--
              schedule()
            },
            (error: unknown) => {
              activeCount--
              if (!hasError) {
                hasError = true
                firstError = error
              }
              schedule()
            }
          )
        }

        settleIfComplete()
      }

      this.concurrencyChangeHandlers.add(schedule)
      schedule()
    })
  }

  private async waitForRiskControlCooldown(
    error: AmazonRiskControlError,
    onProgress: CrawlerProgressHandler,
    signal?: AbortSignal
  ): Promise<void> {
    this.state.phase = DELIVERY_DETAIL_PHASE.RISK_CONTROL_COOLDOWN
    this.state.lastError = getErrorMessage(error)
    this.notifyStateChange()
    onProgress('[风控] 商品详情并发采集暂停，等待 5 分钟后自动继续。')

    await sleep(DELIVERY_DETAIL_RISK_CONTROL_COOLDOWN_MS, signal)
    throwIfAborted(signal)

    this.state.lastError = undefined
    this.setPhase(DELIVERY_DETAIL_PHASE.WAITING)
    onProgress('[详情] 商品详情风控冷却结束，重新尝试采集待处理商品。')
  }

  private updateQueueItem(productId: number, patch: Partial<DeliveryDetailQueueItem>): void {
    this.state.queue = this.state.queue.map((item) =>
      item.productId === productId ? { ...item, ...patch } : item
    )
    this.notifyStateChange()
  }

  private updateWaitingProductCount(waitingProductCount: number): void {
    if (this.state.waitingProductCount === waitingProductCount) return

    this.state.waitingProductCount = waitingProductCount
    this.notifyStateChange()
  }

  private setPhase(phase: DeliveryDetailState['phase']): void {
    this.state.phase = phase
    this.notifyStateChange()
  }

  private notifyStateChange(): void {
    this.onStateChange(this.getState())
  }
}
