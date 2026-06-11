import { CRAWL_TASK_STATUS, SELLERSPRITE_ACCOUNT_STATUS } from '../config/database'
import { WINDOW_CHANNEL } from '../config/ipc'
import { resolveAmazonMarketplace } from '../config/amazon'
import type {
  AmazonSearchConfig,
  AmazonSearchMetrics,
  AmazonSearchStartResult,
  AmazonSearchStatus,
  AmazonSearchStopResult,
  AmazonSearchRunState
} from '../../shared/amazon-search'
import { AMAZON_SEARCH_TASK_TYPE, AMAZON_SEARCH_TASK_TYPE_NAME } from '../../shared/amazon-search'
import type { Amz123HotwordRow, Amz123RangeRequest } from './amz123.service'
import { amz123Service, buildAmz123RangeRequests } from './amz123.service'
import {
  getAmazonSearchConfig,
  saveAmazonSearchConfig,
  getAmz123Session,
  clearAmz123Session,
  isAmz123SessionValid
} from './amazon-search-settings.service'
import { amazonClient } from './crawler/amazon-client'
import { retryWithCrawlerRecovery } from './crawler/recovery'
import { parseAmazonSearchKeywordHtml } from './crawler/search-keyword-parser'
import { buildSellerSpriteDetailsByAsin } from './crawler/sellersprite-enrichment'
import { SellerSpriteAuthenticationError } from './crawler/errors'
import { sellerSpriteSessionService } from './crawler/sellersprite-session'
import { databaseService } from './database.service'
import { createAbortError, getErrorMessage, isAbortError, throwIfAborted } from '../utils/error'
import { createCompactTimestamp } from '../utils/time'
import { sendToFirstWindow } from '../utils/window-bus'

interface KeywordWorkItem {
  keyword: string
  raw: Record<string, unknown>
  range: Amz123RangeRequest
}

interface KeywordServerSubmitItem {
  keyword: string
  image: string
  matchedProductCount: number
}

const INITIAL_METRICS: AmazonSearchMetrics = {
  totalKeywords: 0,
  processedKeywords: 0,
  savedKeywords: 0,
  totalCollected: 0,
  failedKeywords: 0
}

const KEYWORD_SERVER_BATCH_SIZE = 100
const KEYWORD_SERVER_ENDPOINT = 'https://zying.feassh.workers.dev/insertBatch'
const KEYWORD_SERVER_TOKEN = 'feassh-zying-cf-worker-token'

function createSearchUrl(baseUrl: string, keyword: string): string {
  const url = new URL('/s', baseUrl)
  url.searchParams.set('k', keyword)
  url.searchParams.set('language', 'zh_CN')
  return url.href
}

function serializeRange(range: number[]): string {
  return range.length > 0 ? `[${range.join(', ')}]` : '全部'
}

function createFilterCriteria(config: AmazonSearchConfig): string {
  return `${config.minDeliveryInterval}-${config.maxDeliveryInterval}-${config.matchingProductCount}`
}

function createMetrics(): AmazonSearchMetrics {
  return { ...INITIAL_METRICS }
}

class AmazonSearchService {
  private activeTaskId: number | null = null
  private activeConfig: AmazonSearchConfig | null = null
  private runState: AmazonSearchRunState = 'idle'
  private abortController: AbortController | null = null
  private metrics: AmazonSearchMetrics = createMetrics()
  private keywordServerQueue: KeywordServerSubmitItem[] = []
  private keywordServerSubmitChain: Promise<void> = Promise.resolve()

  private get isRunning(): boolean {
    return this.runState !== 'idle'
  }

  private get isStopping(): boolean {
    return this.runState === 'stopping'
  }

  public getLocalState(): {
    session: ReturnType<typeof getAmz123Session>
    config: AmazonSearchConfig
    status: AmazonSearchStatus
  } {
    const session = getAmz123Session()
    if (session && !isAmz123SessionValid(session)) {
      clearAmz123Session()
      this.sendLog('[AMZ123] 本地登录凭证已过期，已自动清理，请重新扫码登录。')
    }

    return {
      session: isAmz123SessionValid(session) ? session : null,
      config: getAmazonSearchConfig(),
      status: this.getStatus()
    }
  }

  public saveConfig(config: AmazonSearchConfig): AmazonSearchConfig {
    return saveAmazonSearchConfig(config)
  }

  public logout(): void {
    clearAmz123Session()
    this.sendLog('[AMZ123] 已退出登录并清理本地 token。')
  }

  public startTask(config: AmazonSearchConfig): AmazonSearchStartResult {
    if (this.isRunning) {
      throw new Error('当前已有正在执行或停止中的亚马逊搜索词采集任务。')
    }

    this.assertAvailableSellerSpriteAccount()

    const session = getAmz123Session()
    if (!isAmz123SessionValid(session)) {
      clearAmz123Session()
      throw new Error('AMZ123 登录凭证不存在或已过期，请重新扫码登录。')
    }

    const normalizedConfig = saveAmazonSearchConfig(config)
    const marketplaceConfig = resolveAmazonMarketplace(normalizedConfig.marketplace)
    const taskName = createCompactTimestamp()
    const taskId = databaseService.createTask(
      taskName,
      AMAZON_SEARCH_TASK_TYPE,
      normalizedConfig.marketplace
    )

    this.prepareTask(taskId, normalizedConfig)
    this.sendLog(
      `[开始] 启动${AMAZON_SEARCH_TASK_TYPE_NAME}，任务名称: ${taskName} | 站点: ${marketplaceConfig.siteName}。`
    )

    void this.runTask(taskId, normalizedConfig, session.token).catch((error) => {
      this.handleUnexpectedBackgroundError(taskId, error)
    })

    return {
      taskId,
      runState: 'running'
    }
  }

  public stopTask(): AmazonSearchStopResult {
    const taskId = this.activeTaskId
    if (!this.isRunning || taskId === null) {
      return {
        accepted: false,
        taskId: null,
        runState: 'idle',
        databaseStatusUpdated: false
      }
    }

    if (this.isStopping) {
      return {
        accepted: false,
        taskId,
        runState: this.runState,
        databaseStatusUpdated: false
      }
    }

    this.runState = 'stopping'
    this.abortController?.abort()
    const databaseStatusUpdated = this.tryUpdateTaskStatus(taskId, CRAWL_TASK_STATUS.CANCELLED)
    this.sendLog('[终止] 已收到手动停止信号，正在结束当前搜索词采集任务。')
    this.broadcastState()

    return {
      accepted: true,
      taskId,
      runState: this.runState,
      databaseStatusUpdated
    }
  }

  public getStatus(): AmazonSearchStatus {
    return {
      isRunning: this.isRunning,
      isStopping: this.isStopping,
      runState: this.runState,
      taskId: this.activeTaskId,
      config: this.activeConfig,
      metrics: { ...this.metrics }
    }
  }

  private async runTask(
    taskId: number,
    config: AmazonSearchConfig,
    amz123Token: string
  ): Promise<void> {
    const signal = this.abortController?.signal
    const marketplaceConfig = resolveAmazonMarketplace(config.marketplace)

    try {
      this.sendLog(
        `[参数] AMZ123 本周排名: ${config.selectedRanks.join(', ')} | 涨跌幅度: ${config.selectedChanges.join(', ')}。`
      )
      this.sendLog(
        `[参数] 配送间隔: ${config.minDeliveryInterval}-${config.maxDeliveryInterval} 天 | 最少匹配商品数: ${config.matchingProductCount}。`
      )
      this.sendLog(`[参数] 搜索词采集并发数: ${config.concurrency}。`)

      const cookieResult = await amazonClient.getCookies(
        config.marketplace,
        (log) => this.sendLog(log),
        signal
      )
      this.sendLog(
        `[成功] 获得 ${marketplaceConfig.siteName} Cookie。当前配送地址: ${cookieResult.address || '未知'}。`
      )

      const keywords = await this.fetchAllKeywordWorkItems(config, amz123Token, signal)
      this.metrics.totalKeywords = keywords.length
      this.broadcastState()
      this.sendLog(
        `[AMZ123] 去重后共获取 ${keywords.length} 个搜索词，开始逐词筛选 Amazon 搜索结果。`
      )

      await this.processKeywordsConcurrently(taskId, keywords, config, cookieResult.cookies, signal)

      if (this.isStopping) {
        this.tryUpdateTaskStatus(taskId, CRAWL_TASK_STATUS.CANCELLED)
        this.sendLog('[终止] 亚马逊搜索词采集任务已手动停止。')
      } else {
        this.metrics.completedAt = new Date().toISOString()
        this.tryUpdateTaskStatus(taskId, CRAWL_TASK_STATUS.COMPLETED)
        this.sendLog(
          `[完成] ${AMAZON_SEARCH_TASK_TYPE_NAME}已完成：保存搜索词 ${this.metrics.savedKeywords} 个，商品 ${this.metrics.totalCollected} 个。`
        )
      }
    } catch (error) {
      if (this.isStopping || isAbortError(error)) {
        this.tryUpdateTaskStatus(taskId, CRAWL_TASK_STATUS.CANCELLED)
        this.sendLog('[终止] 亚马逊搜索词采集任务已停止。')
      } else {
        this.tryUpdateTaskStatus(taskId, CRAWL_TASK_STATUS.FAILED)
        this.sendLog(`[错误] 亚马逊搜索词采集异常终止: ${getErrorMessage(error)}`)
      }
    } finally {
      await this.flushKeywordServerQueue(taskId)
      this.resetTask(taskId)
    }
  }

  private async fetchAllKeywordWorkItems(
    config: AmazonSearchConfig,
    token: string,
    signal?: AbortSignal
  ): Promise<KeywordWorkItem[]> {
    const itemsByKeyword = new Map<string, KeywordWorkItem>()
    const ranges = buildAmz123RangeRequests(config)

    for (const range of ranges) {
      throwIfAborted(signal)
      this.sendLog(
        `[AMZ123] 正在读取热词列表：本周排名 ${range.rankingLabel}，涨跌幅度 ${range.fluctuationLabel}。`
      )

      let pageNumber = 1
      let totalPages = 1
      do {
        throwIfAborted(signal)
        const page = await amz123Service.fetchHotwordPage(token, config, range, pageNumber, signal)
        totalPages = Math.max(1, Math.ceil(page.total / 200))
        this.sendLog(
          `[AMZ123] 第 ${pageNumber}/${totalPages} 页返回 ${page.rows.length} 个搜索词，接口总数 ${page.total}。`
        )

        for (const row of page.rows) {
          if (!itemsByKeyword.has(row.word)) {
            itemsByKeyword.set(row.word, this.createKeywordWorkItem(row, range))
          }
        }

        pageNumber++
      } while (pageNumber <= totalPages)
    }

    return Array.from(itemsByKeyword.values())
  }

  private createKeywordWorkItem(row: Amz123HotwordRow, range: Amz123RangeRequest): KeywordWorkItem {
    return {
      keyword: row.word,
      raw: row.raw,
      range
    }
  }

  private async processKeywordsConcurrently(
    taskId: number,
    keywords: KeywordWorkItem[],
    config: AmazonSearchConfig,
    cookies: string,
    signal?: AbortSignal
  ): Promise<void> {
    if (keywords.length === 0) return

    const workerCount = Math.min(Math.max(1, Math.floor(config.concurrency)), keywords.length)
    let nextIndex = 0

    this.sendLog(`[系统] 已启动 ${workerCount} 个搜索词采集 worker。`)

    const runWorker = async (workerIndex: number): Promise<void> => {
      while (true) {
        throwIfAborted(signal)
        if (this.isStopping) throw createAbortError()

        const currentIndex = nextIndex
        nextIndex++
        const item = keywords[currentIndex]
        if (!item) return

        this.sendLog(
          `[并发] Worker ${workerIndex + 1}/${workerCount} 正在处理第 ${currentIndex + 1}/${keywords.length} 个搜索词。`
        )
        try {
          await this.processKeyword(taskId, item, config, cookies, signal)
          this.broadcastState()
        } catch (error) {
          if (isAbortError(error)) throw error
          if (error instanceof SellerSpriteAuthenticationError) {
            this.abortController?.abort()
            throw error
          }

          throw error
        }
      }
    }

    await Promise.all(Array.from({ length: workerCount }, (_, index) => runWorker(index)))
  }

  private async processKeyword(
    taskId: number,
    item: KeywordWorkItem,
    config: AmazonSearchConfig,
    cookies: string,
    signal?: AbortSignal
  ): Promise<void> {
    const marketplaceConfig = resolveAmazonMarketplace(config.marketplace)
    const searchUrl = createSearchUrl(marketplaceConfig.baseUrl, item.keyword)
    let processedCounted = false
    this.sendLog(`[搜索] 正在处理搜索词 "${item.keyword}" | URL: ${searchUrl}`)

    try {
      const html = await retryWithCrawlerRecovery(
        () => amazonClient.fetchHtml(searchUrl, cookies, signal, 'detail'),
        {
          scope: `[搜索词] ${item.keyword}`,
          onProgress: (log) => this.sendLog(log),
          signal
        }
      )
      const parsedResult = parseAmazonSearchKeywordHtml(
        html,
        item.keyword,
        config,
        marketplaceConfig.baseUrl
      )

      this.metrics.processedKeywords++
      processedCounted = true

      if (!parsedResult) {
        this.sendLog(
          `[筛选] 搜索词 "${item.keyword}" 未达到阈值，已跳过。要求至少 ${config.matchingProductCount} 个商品满足配送间隔。`
        )
        return
      }

      const sellerSpriteData = await this.getQuickViewData(
        parsedResult.products,
        item.keyword,
        signal
      )
      const detailsByAsin = buildSellerSpriteDetailsByAsin(sellerSpriteData)
      const productsToPersist = parsedResult.products.map((product) => ({
        ...product,
        sellerSprite: detailsByAsin.get(product.asin || '')
      }))
      const enrichedCount = productsToPersist.filter((product) => product.sellerSprite).length

      databaseService.insertAmazonSearchKeywordResult(taskId, {
        keyword: parsedResult.keyword,
        keywordImage: parsedResult.keywordImage,
        filterCriteria: createFilterCriteria(config),
        matchedProductCount: parsedResult.matchedProductCount,
        totalProductCount: parsedResult.totalProductCount,
        rankingRange: serializeRange(item.range.rankingRange),
        fluctuationRange: serializeRange(item.range.fluctuationRange),
        amz123Raw: JSON.stringify(item.raw),
        products: productsToPersist
      })

      this.metrics.savedKeywords++
      this.metrics.totalCollected += productsToPersist.length
      this.enqueueKeywordServerSubmit(taskId, {
        keyword: parsedResult.keyword,
        image: parsedResult.keywordImage,
        matchedProductCount: parsedResult.matchedProductCount
      })
      this.sendLog(
        `[数据] 搜索词 "${item.keyword}" 已入库：匹配商品 ${productsToPersist.length} 个，其中 ${enrichedCount} 个包含卖家精灵数据。`
      )
    } catch (error) {
      if (isAbortError(error)) throw error
      if (error instanceof SellerSpriteAuthenticationError) throw error
      if (!processedCounted) {
        this.metrics.processedKeywords++
      }
      this.metrics.failedKeywords++
      this.sendLog(
        `[警告] 搜索词 "${item.keyword}" 处理失败，继续下一个：${getErrorMessage(error)}`
      )
    }
  }

  private async getQuickViewData(
    products: Array<{ asin?: string }>,
    keyword: string,
    signal?: AbortSignal
  ) {
    const asins = products
      .map((product) => product.asin)
      .filter((asin): asin is string => Boolean(asin))
    if (asins.length === 0) return null

    this.sendLog(`[卖家精灵] 搜索词 "${keyword}" 正在请求 ${asins.length} 个商品的竞品分析数据。`)

    try {
      const data = await sellerSpriteSessionService.fetchQuickViewWithRetry(
        asins,
        (log) => this.sendLog(log),
        signal
      )
      this.sendLog(
        `[卖家精灵] 搜索词 "${keyword}" quick-view 成功，返回 ${data.data?.items?.length || 0} 条。`
      )
      return data
    } catch (error) {
      if (isAbortError(error)) throw error
      if (error instanceof SellerSpriteAuthenticationError) throw error

      this.sendLog(
        `[警告] 搜索词 "${keyword}" 卖家精灵数据获取失败，本词仅保存 Amazon 基础数据: ${getErrorMessage(error)}`
      )
      return null
    }
  }

  private assertAvailableSellerSpriteAccount(): void {
    const hasAvailableAccount = databaseService
      .querySpriteAccounts()
      .some((account) => account.status === SELLERSPRITE_ACCOUNT_STATUS.NORMAL)

    if (!hasAvailableAccount) {
      throw new Error('没有可用的卖家精灵账号，请先在设置中添加账号。')
    }
  }

  private prepareTask(taskId: number, config: AmazonSearchConfig): void {
    this.activeTaskId = taskId
    this.activeConfig = config
    this.runState = 'running'
    this.abortController = new AbortController()
    this.keywordServerQueue = []
    this.keywordServerSubmitChain = Promise.resolve()
    this.metrics = {
      ...createMetrics(),
      startedAt: new Date().toISOString()
    }
    this.broadcastState()
  }

  private resetTask(taskId: number): void {
    if (this.activeTaskId !== taskId) return

    this.activeTaskId = null
    this.activeConfig = null
    this.runState = 'idle'
    this.abortController = null
    this.broadcastState()
  }

  private tryUpdateTaskStatus(
    taskId: number,
    status: Exclude<(typeof CRAWL_TASK_STATUS)[keyof typeof CRAWL_TASK_STATUS], 'running'>
  ): boolean {
    try {
      return databaseService.updateTaskStatus(taskId, status)
    } catch (error) {
      this.sendLog(`[数据库] 警告：更新搜索词任务状态失败: ${getErrorMessage(error)}`)
      return false
    }
  }

  private handleUnexpectedBackgroundError(taskId: number, error: unknown): void {
    const status =
      this.isStopping || isAbortError(error)
        ? CRAWL_TASK_STATUS.CANCELLED
        : CRAWL_TASK_STATUS.FAILED
    this.tryUpdateTaskStatus(taskId, status)
    this.sendLog(`[错误] 搜索词采集后台异常: ${getErrorMessage(error)}`)
    this.resetTask(taskId)
  }

  private broadcastState(): void {
    sendToFirstWindow(WINDOW_CHANNEL.AMAZON_SEARCH_STATE_UPDATE, this.getStatus())
  }

  private sendLog(log: string): void {
    sendToFirstWindow(WINDOW_CHANNEL.AMAZON_SEARCH_LOG_PROGRESS, log)
  }

  private enqueueKeywordServerSubmit(taskId: number, item: KeywordServerSubmitItem): void {
    this.keywordServerQueue.push(item)

    if (this.keywordServerQueue.length < KEYWORD_SERVER_BATCH_SIZE) {
      return
    }

    const batch = this.keywordServerQueue.splice(0, KEYWORD_SERVER_BATCH_SIZE)
    this.keywordServerSubmitChain = this.keywordServerSubmitChain
      .then(() => this.submitKeywordBatchToServer(taskId, batch))
      .catch(() => undefined)
  }

  private async flushKeywordServerQueue(taskId: number): Promise<void> {
    const batch = this.keywordServerQueue.splice(0)
    this.keywordServerSubmitChain = this.keywordServerSubmitChain
      .then(() => this.submitKeywordBatchToServer(taskId, batch))
      .catch(() => undefined)

    await this.keywordServerSubmitChain
  }

  private async submitKeywordBatchToServer(
    taskId: number,
    batch: KeywordServerSubmitItem[]
  ): Promise<void> {
    if (batch.length === 0) return

    try {
      const response = await fetch(KEYWORD_SERVER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: batch.map((item) => ({
            kw: item.keyword,
            img: item.image,
            filter_criteria: '',
            kw_products_count: item.matchedProductCount,
            task_id: taskId
          })),
          productData: [],
          token: KEYWORD_SERVER_TOKEN
        })
      })
      const responseBody = (await response.json().catch(() => null)) as { code?: number } | null

      if (!response.ok || responseBody?.code !== 0) {
        return
      }
    } catch {
      return
    }
  }
}

export const amazonSearchService = new AmazonSearchService()
