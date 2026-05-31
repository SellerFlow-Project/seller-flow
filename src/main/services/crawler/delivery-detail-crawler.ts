import { createAmazonProductDetailUrl, resolveAmazonMarketplace } from '../../config/amazon'
import {
  DELIVERY_DETAIL_BATCH_SIZE,
  DELIVERY_DETAIL_CONCURRENCY,
  DELIVERY_DETAIL_ITEM_STATUS,
  DELIVERY_DETAIL_PHASE,
  DELIVERY_DETAIL_POLL_INTERVAL_MS
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
import { getErrorMessage, isAbortError, throwIfAborted } from '../../utils/error'
import { sleep } from '../../utils/time'
import { databaseService } from '../database.service'
import { amazonClient } from './amazon-client'
import { parseAmazonDeliveryDetailHtml } from './delivery-parser'

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

function createInitialState(): DeliveryDetailState {
  return {
    phase: DELIVERY_DETAIL_PHASE.IDLE,
    batchSize: DELIVERY_DETAIL_BATCH_SIZE,
    concurrency: DELIVERY_DETAIL_CONCURRENCY,
    batchNumber: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    waitingProductCount: 0,
    queue: []
  }
}

export class AmazonDeliveryDetailCrawler {
  private state = createInitialState()

  public constructor(private readonly onStateChange: StateChangeHandler) {}

  public getState(): DeliveryDetailState {
    return {
      ...this.state,
      queue: this.state.queue.map((item) => ({ ...item }))
    }
  }

  public reset(): void {
    this.state = createInitialState()
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
      `[详情] 配送天数采集器已启动：每批 ${DELIVERY_DETAIL_BATCH_SIZE} 个商品，并发数 ${DELIVERY_DETAIL_CONCURRENCY}。`
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

      await this.processBatch(batch, marketplace, cookies, deferredProductIds, onProgress, signal)
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

    const results = await this.mapWithConcurrency(batch, (product) =>
      this.fetchProductDetail(product, marketplace, cookies, signal)
    )
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

      this.updateQueueItem(product.id, {
        status: DELIVERY_DETAIL_ITEM_STATUS.FAILED,
        error: getErrorMessage(error)
      })
      return { failedProductId: product.id }
    }
  }

  private async mapWithConcurrency<TItem, TResult>(
    items: TItem[],
    handler: (item: TItem) => Promise<TResult>
  ): Promise<TResult[]> {
    const results = new Array<TResult>(items.length)
    let nextIndex = 0
    const workers = Array.from(
      { length: Math.min(DELIVERY_DETAIL_CONCURRENCY, items.length) },
      async () => {
        while (nextIndex < items.length) {
          const currentIndex = nextIndex++
          results[currentIndex] = await handler(items[currentIndex])
        }
      }
    )

    await Promise.all(workers)
    return results
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
