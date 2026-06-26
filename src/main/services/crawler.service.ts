import {
  DEFAULT_AMAZON_BASE_URL,
  DEFAULT_AMAZON_MARKETPLACE,
  createAmazonRankingUrl,
  resolveAmazonMarketplace
} from '../config/amazon'
import { CRAWLER_INITIAL_DEPTH, CRAWLER_RUN_STATE, CRAWL_TASK_TYPE } from '../config/crawler'
import { CRAWL_TASK_STATUS, SELLERSPRITE_ACCOUNT_STATUS } from '../config/database'
import { WINDOW_CHANNEL } from '../config/ipc'
import type {
  AmazonCategory,
  AmazonCookieResult,
  AmazonMarketplaceConfig,
  AmazonRankingPageResult
} from '../types/amazon'
import type {
  CrawlerProgressHandler,
  CrawlerRunState,
  CrawlerStartResult,
  CrawlerStatus,
  CrawlerStopResult,
  CrawlTaskConfig,
  DfsState
} from '../types/crawler'
import { CRAWL_TASK_TYPE_NAMES, isCrawlTaskType, type CrawlTaskType } from '../../shared/crawler'
import { getErrorMessage, isAbortError } from '../utils/error'
import { createCompactTimestamp } from '../utils/time'
import { logAndSendCrawlerLog, sendToFirstWindow } from '../utils/window-bus'
import { amazonClient } from './crawler/amazon-client'
import {
  parseAmazonRankingCategories,
  parseAmazonRankingChildCategories
} from './crawler/amazon-parser'
import { AmazonCategoryCrawler } from './crawler/category-crawler'
import { AmazonDeliveryDetailCrawler } from './crawler/delivery-detail-crawler'
import { retryWithCrawlerRecovery } from './crawler/recovery'
import { databaseService } from './database.service'

export { parseAmazonRankingHtml, parseAmazonBestSellerHtml } from './crawler/amazon-parser'

/**
 * 亚马逊商品流核心任务编排服务 (Main 进程)
 */
class CrawlerService {
  private activeTask: CrawlTaskConfig | null = null
  private activeTaskId: number | null = null
  private runState: CrawlerRunState = CRAWLER_RUN_STATE.IDLE
  private abortController: AbortController | null = null
  private firstLevelCatsList: string[] = []
  private readonly completedPrimaries = new Set<string>()
  private readonly categoryCrawler = new AmazonCategoryCrawler(
    () => this.isStopping,
    () => this.broadcastState()
  )
  private readonly deliveryDetailCrawler = new AmazonDeliveryDetailCrawler(() =>
    this.broadcastState()
  )

  private get isRunning(): boolean {
    return this.runState !== CRAWLER_RUN_STATE.IDLE
  }

  private get isStopping(): boolean {
    return this.runState === CRAWLER_RUN_STATE.STOPPING
  }

  private broadcastState(): void {
    sendToFirstWindow(WINDOW_CHANNEL.CRAWLER_STATE_UPDATE, this.getDfsState())
  }

  private sendLog(log: string): void {
    logAndSendCrawlerLog(log)
  }

  public async getAmazonCookies(
    marketplace: string = DEFAULT_AMAZON_MARKETPLACE,
    signal?: AbortSignal
  ): Promise<AmazonCookieResult> {
    return await amazonClient.getCookies(marketplace, (log) => this.sendLog(log), signal)
  }

  public parseRankingCategories(html: string, baseUrl = DEFAULT_AMAZON_BASE_URL): AmazonCategory[] {
    return parseAmazonRankingCategories(html, baseUrl)
  }

  public parseRankingChildCategories(
    html: string,
    currentUrl = DEFAULT_AMAZON_BASE_URL
  ): AmazonCategory[] {
    return parseAmazonRankingChildCategories(html, currentUrl)
  }

  public async fetchRankingPage(
    cookies: string,
    marketplace: string = DEFAULT_AMAZON_MARKETPLACE,
    taskType: CrawlTaskType = CRAWL_TASK_TYPE.BEST_SELLERS
  ): Promise<AmazonRankingPageResult> {
    return await amazonClient.fetchRankingPage(cookies, marketplace, taskType)
  }

  public async fetchHtml(url: string, cookies: string, signal?: AbortSignal): Promise<string> {
    return await amazonClient.fetchHtml(url, cookies, signal)
  }

  public getDfsState(): DfsState {
    return {
      firstLevelCats: this.firstLevelCatsList,
      completedPrimaries: Array.from(this.completedPrimaries),
      activePath: this.categoryCrawler.getActivePath(),
      isCrawling: this.isRunning,
      runState: this.runState,
      deliveryDetail: this.deliveryDetailCrawler.getState()
    }
  }

  public startTask(
    config: CrawlTaskConfig,
    onProgress: CrawlerProgressHandler
  ): CrawlerStartResult {
    if (this.isRunning) {
      throw new Error('当前已有正在执行或停止中的爬虫任务！')
    }

    if (!isCrawlTaskType(config.taskType)) {
      throw new Error('暂不支持该采集任务类型')
    }

    this.assertAvailableSellerSpriteAccount(onProgress)

    const taskName = createCompactTimestamp()
    const marketplace = config.marketplace || DEFAULT_AMAZON_MARKETPLACE
    const marketplaceConfig = resolveAmazonMarketplace(marketplace)
    const deliveryConcurrency = Math.max(1, Math.floor(config.deliveryConcurrency || 1))
    const normalizedConfig: CrawlTaskConfig = {
      ...config,
      marketplace,
      deliveryConcurrency
    }
    const taskId = databaseService.createTask(taskName, normalizedConfig.taskType, marketplace)

    this.prepareTask(taskId, normalizedConfig)
    onProgress(
      `[开始] 启动亚马逊智能爬虫系统... 任务名称: ${taskName} | 类型: ${CRAWL_TASK_TYPE_NAMES[normalizedConfig.taskType]} | 站点: ${marketplaceConfig.siteName} | 核心策略: "递归降级深度遍历 (DFS)" | 商品详情并发: ${deliveryConcurrency}`
    )

    void this.runTask(taskId, normalizedConfig, marketplaceConfig, onProgress).catch((error) => {
      this.handleUnexpectedBackgroundError(taskId, error, onProgress)
    })

    return {
      taskId,
      runState: CRAWLER_RUN_STATE.RUNNING
    }
  }

  public stopTask(): CrawlerStopResult {
    const taskId = this.activeTaskId
    if (!this.isRunning || taskId === null) {
      return {
        accepted: false,
        taskId: null,
        runState: CRAWLER_RUN_STATE.IDLE,
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

    this.runState = CRAWLER_RUN_STATE.STOPPING
    this.deliveryDetailCrawler.stop()
    this.abortController?.abort()
    const databaseStatusUpdated = this.tryUpdateTaskStatus(
      taskId,
      CRAWL_TASK_STATUS.CANCELLED,
      (message) => this.sendLog(message)
    )
    this.sendLog('[终止] 已收到手动停止信号，正在结束当前请求并清理任务状态。')
    this.broadcastState()

    return {
      accepted: true,
      taskId,
      runState: this.runState,
      databaseStatusUpdated
    }
  }

  public getStatus(): CrawlerStatus {
    return {
      isRunning: this.isRunning,
      isStopping: this.isStopping,
      runState: this.runState,
      taskId: this.activeTaskId,
      config: this.activeTask
    }
  }

  private async runTask(
    taskId: number,
    config: CrawlTaskConfig,
    marketplaceConfig: AmazonMarketplaceConfig,
    onProgress: CrawlerProgressHandler
  ): Promise<void> {
    const signal = this.abortController?.signal
    let isCategoryCrawlComplete = false
    let deliveryDetailError: unknown
    let deliveryDetailOutcome: Promise<void> | null = null

    try {
      const cookieResult = await this.getAmazonCookies(marketplaceConfig.code, signal)
      onProgress(
        `[成功] 获得 ${marketplaceConfig.code} 站点 Cookie 凭证。当前配送地址: ${cookieResult.address}`
      )
      const firstLevelCategories = await this.getFirstLevelCategories(
        config,
        marketplaceConfig,
        cookieResult.cookies,
        onProgress,
        signal
      )

      this.firstLevelCatsList = firstLevelCategories.map((category) => category.name)
      this.broadcastState()
      onProgress(
        `[成功] 成功检索到 ${firstLevelCategories.length} 个首级核心分类目录，开始启动 DFS 深度迭代爬网...`
      )
      deliveryDetailOutcome = this.deliveryDetailCrawler
        .run({
          taskId,
          marketplace: marketplaceConfig.code,
          cookies: cookieResult.cookies,
          signal,
          isSourceComplete: () => isCategoryCrawlComplete,
          onProgress
        })
        .catch((error) => {
          deliveryDetailError = error
          if (!isAbortError(error)) {
            this.deliveryDetailCrawler.fail(error)
            onProgress(`[错误] 商品详情并发采集已熔断: ${getErrorMessage(error)}`)
            this.abortController?.abort()
          }
        })

      for (const category of firstLevelCategories) {
        if (this.isStopping) break

        onProgress(`[首级] 🚀 开始处理一级分类线: [${category.name}]`)
        await this.categoryCrawler.traverse(
          category,
          cookieResult.cookies,
          CRAWLER_INITIAL_DEPTH,
          taskId,
          onProgress,
          signal
        )
        if (this.isStopping) break

        this.completedPrimaries.add(category.name)
        this.broadcastState()
        onProgress(`[回溯] 🟢 一级分类线 [${category.name}] 处理完毕，回滚回顶层目录。`)
      }

      isCategoryCrawlComplete = true
      await deliveryDetailOutcome
      if (deliveryDetailError) throw deliveryDetailError

      if (this.isStopping) {
        onProgress('[终止] 后台爬取任务已被手动终止。')
        this.tryUpdateTaskStatus(taskId, CRAWL_TASK_STATUS.CANCELLED, onProgress)
      } else {
        onProgress('[完成] 🎉 亚马逊排行榜全级分类深度优先遍历 (DFS) 商品抓取任务已全部圆满完成！')
        this.tryUpdateTaskStatus(taskId, CRAWL_TASK_STATUS.COMPLETED, onProgress)
      }
    } catch (error) {
      isCategoryCrawlComplete = true
      this.abortController?.abort()
      await deliveryDetailOutcome
      const taskError =
        deliveryDetailError && !isAbortError(deliveryDetailError) ? deliveryDetailError : error

      if (this.isStopping || (isAbortError(taskError) && !deliveryDetailError)) {
        onProgress('[终止] 后台爬取任务已被手动终止。')
        this.tryUpdateTaskStatus(taskId, CRAWL_TASK_STATUS.CANCELLED, onProgress)
      } else {
        onProgress(`[错误] 任务爬取异常终止: ${getErrorMessage(taskError)}`)
        this.tryUpdateTaskStatus(taskId, CRAWL_TASK_STATUS.FAILED, onProgress)
      }
    } finally {
      this.resetTask(taskId)
    }
  }

  private assertAvailableSellerSpriteAccount(onProgress: CrawlerProgressHandler): void {
    const hasAvailableAccount = databaseService
      .querySpriteAccounts()
      .some((account) => account.status === SELLERSPRITE_ACCOUNT_STATUS.NORMAL)

    if (!hasAvailableAccount) {
      onProgress(
        `[错误] 启动任务失败：本地 SQLite 数据库中没有可用的“正常”状态卖家精灵账号，请先添加账号！`
      )
      throw new Error('没有可用的卖家精灵账号，禁止启动采集任务！')
    }
  }

  private prepareTask(taskId: number, config: CrawlTaskConfig): void {
    this.activeTaskId = taskId
    this.activeTask = config
    this.runState = CRAWLER_RUN_STATE.RUNNING
    this.abortController = new AbortController()
    this.firstLevelCatsList = []
    this.completedPrimaries.clear()
    this.categoryCrawler.reset()
    this.deliveryDetailCrawler.configureConcurrency(config.deliveryConcurrency || 1)
    this.deliveryDetailCrawler.reset()
  }

  private resetTask(taskId: number): void {
    if (this.activeTaskId !== taskId) return

    this.activeTaskId = null
    this.activeTask = null
    this.runState = CRAWLER_RUN_STATE.IDLE
    this.abortController = null
    this.deliveryDetailCrawler.markIdle()
    this.categoryCrawler.reset()
  }

  private async getFirstLevelCategories(
    config: CrawlTaskConfig,
    marketplaceConfig: AmazonMarketplaceConfig,
    cookies: string,
    onProgress: CrawlerProgressHandler,
    signal?: AbortSignal
  ): Promise<AmazonCategory[]> {
    if (config.selectedCategories?.length) {
      onProgress(
        `[系统] 使用用户自定义调整后的首级分类列表 (共 ${config.selectedCategories.length} 个)...`
      )
      return config.selectedCategories
    }

    onProgress(
      `[首级] 正在读取 ${marketplaceConfig.siteName} ${CRAWL_TASK_TYPE_NAMES[config.taskType]}顶级核心主分类...`
    )
    const rankingUrl = createAmazonRankingUrl(marketplaceConfig.baseUrl, config.taskType)
    const html = await retryWithCrawlerRecovery(() => this.fetchHtml(rankingUrl, cookies, signal), {
      scope: `[首级] ${marketplaceConfig.siteName} ${CRAWL_TASK_TYPE_NAMES[config.taskType]}入口页 | URL: ${rankingUrl}`,
      onProgress,
      signal
    })
    const categories = this.parseRankingCategories(html, marketplaceConfig.baseUrl)
    if (categories.length === 0) {
      throw new Error('未能解析到任何顶级分类')
    }

    return categories
  }

  private tryUpdateTaskStatus(
    taskId: number,
    status: Exclude<
      (typeof CRAWL_TASK_STATUS)[keyof typeof CRAWL_TASK_STATUS],
      typeof CRAWL_TASK_STATUS.RUNNING
    >,
    onProgress: CrawlerProgressHandler
  ): boolean {
    try {
      return databaseService.updateTaskStatus(taskId, status)
    } catch (error) {
      onProgress(`[数据库] 警告：更新任务状态失败: ${getErrorMessage(error)}`)
      return false
    }
  }

  private handleUnexpectedBackgroundError(
    taskId: number,
    error: unknown,
    onProgress: CrawlerProgressHandler
  ): void {
    const isCancelled = this.isStopping || isAbortError(error)
    const status = isCancelled ? CRAWL_TASK_STATUS.CANCELLED : CRAWL_TASK_STATUS.FAILED
    const message = isCancelled
      ? '[系统] 采集任务已停止'
      : `[错误] 后台采集任务发生未处理异常: ${getErrorMessage(error)}`

    onProgress(message)
    this.tryUpdateTaskStatus(taskId, status, onProgress)
    this.resetTask(taskId)
  }
}

export const crawlerService = new CrawlerService()
export {
  cleanText,
  absolutizeAmazonUrl,
  getPageFromHref,
  pickBestImage,
  findAsin,
  findProductUrl,
  findTitle,
  findPrice,
  parseAmazonPagination
} from './crawler/amazon-parser'
