import * as cheerio from 'cheerio'
import { AMAZON_MAX_DFS_DEPTH } from '../../config/amazon'
import {
  CRAWLER_CATEGORY_PATH_SEPARATOR,
  CRAWLER_DEPTH_STEP,
  CRAWLER_DEPTH_INDENT,
  CRAWLER_FIRST_LEVEL_DEPTH,
  CRAWLER_INITIAL_PAGE,
  CRAWLER_MAX_CONSECUTIVE_EMPTY_PRODUCT_PAGES,
  CRAWLER_PAGE_STEP
} from '../../config/crawler'
import type { AmazonCategory } from '../../types/amazon'
import type { CrawlerProgressHandler, DfsPathNode } from '../../types/crawler'
import type { SellerSpriteQuickViewResponse } from '../../types/sellersprite'
import { createAbortError, getErrorMessage, isAbortError, throwIfAborted } from '../../utils/error'
import { databaseService } from '../database.service'
import { amazonClient } from './amazon-client'
import {
  parseAmazonBestSellerHtml,
  parseAmazonPagination,
  parseBestsellerChildCategories
} from './amazon-parser'
import { AmazonRiskControlError, SellerSpriteAuthenticationError } from './errors'
import { mergeProductsWithSellerSpriteDetails } from './sellersprite-enrichment'
import { sellerSpriteSessionService } from './sellersprite-session'

type CancellationChecker = () => boolean
type ActivePathChangeHandler = (activePath: DfsPathNode[]) => void

export class AmazonCategoryCrawler {
  private readonly visitedUrls = new Set<string>()
  private readonly activePath: DfsPathNode[] = []
  private consecutiveEmptyProductPages = 0

  public constructor(
    private readonly isCancelled: CancellationChecker,
    private readonly onActivePathChange: ActivePathChangeHandler
  ) {}

  public reset(): void {
    this.visitedUrls.clear()
    this.activePath.length = 0
    this.consecutiveEmptyProductPages = 0
    this.notifyActivePathChange()
  }

  public getActivePath(): DfsPathNode[] {
    return [...this.activePath]
  }

  public async traverse(
    category: AmazonCategory,
    cookies: string,
    currentDepth: number,
    taskId: number,
    onProgress: CrawlerProgressHandler,
    signal?: AbortSignal
  ): Promise<void> {
    this.throwIfCancelled(signal)
    if (this.visitedUrls.has(category.href)) return

    this.visitedUrls.add(category.href)
    this.activePath.push({ name: category.name, depth: currentDepth })
    this.notifyActivePathChange()

    const indent = CRAWLER_DEPTH_INDENT.repeat(currentDepth - CRAWLER_FIRST_LEVEL_DEPTH)
    onProgress(`[DFS] ${indent}➡️ 访问分类: [${category.name}] | URL: ${category.href}`)

    try {
      if (currentDepth !== CRAWLER_FIRST_LEVEL_DEPTH) {
        await this.crawlCategoryPages(category, cookies, taskId, indent, onProgress, signal)
      } else {
        onProgress(
          `[DFS] ${indent}  ℹ️ 首级主分类仅作为导航入口，跳过商品下载，开始向下递归子分类...`
        )
      }

      const subCategories = await this.getSubCategories(
        category,
        cookies,
        currentDepth,
        indent,
        onProgress,
        signal
      )
      this.throwIfCancelled(signal)
      for (const subCategory of subCategories) {
        this.throwIfCancelled(signal)
        if (currentDepth < AMAZON_MAX_DFS_DEPTH) {
          await this.traverse(
            subCategory,
            cookies,
            currentDepth + CRAWLER_DEPTH_STEP,
            taskId,
            onProgress,
            signal
          )
        }
      }
    } finally {
      this.activePath.pop()
      this.notifyActivePathChange()
    }
  }

  private async crawlCategoryPages(
    category: AmazonCategory,
    cookies: string,
    taskId: number,
    indent: string,
    onProgress: CrawlerProgressHandler,
    signal?: AbortSignal
  ): Promise<void> {
    let currentPageUrl = category.href
    let page = CRAWLER_INITIAL_PAGE
    let hasMore = true

    while (hasMore) {
      this.throwIfCancelled(signal)
      onProgress(`[DFS] ${indent}  📥 正在抓取商品列表 (Page ${page})...`)

      try {
        const html = await amazonClient.fetchHtml(currentPageUrl, cookies, signal)
        this.throwIfCancelled(signal)
        const products = parseAmazonBestSellerHtml(html)
        onProgress(`[DFS] ${indent}  ✅ Page ${page} 成功！获取到 ${products.length} 个排名商品`)
        this.assertProductsParsed(products.length, onProgress)

        const quickViewData = await this.getQuickViewData(products, indent, onProgress, signal)
        this.throwIfCancelled(signal)
        if (products.length > 0) {
          const fullCategoryPath = this.activePath
            .map((node) => node.name)
            .join(CRAWLER_CATEGORY_PATH_SEPARATOR)
          const productsToPersist = mergeProductsWithSellerSpriteDetails(products, quickViewData)
          const enrichedCount = productsToPersist.filter((item) => item.sellerSprite).length
          databaseService.insertProducts(taskId, productsToPersist, fullCategoryPath)
          onProgress(
            `[数据] ${indent}    💾 [写入DB] 本页已入库 ${products.length} 个商品，其中 ${enrichedCount} 个包含卖家精灵数据。`
          )
        } else {
          onProgress(`[数据] ${indent}    💾 [写入DB] 本页无商品可写入。`)
        }

        const pagination = parseAmazonPagination(cheerio.load(html), currentPageUrl)
        hasMore = pagination.hasNextPage && Boolean(pagination.nextPageUrl)

        if (hasMore) {
          currentPageUrl = pagination.nextPageUrl
          page = pagination.currentPage
            ? pagination.currentPage + CRAWLER_PAGE_STEP
            : page + CRAWLER_PAGE_STEP
          onProgress(`[DFS] ${indent}  🏷️ 检索到下一页链接，延时准备加载...`)
        } else {
          onProgress(`[DFS] ${indent}  🏁 商品分页抓取完毕，共拉取 ${page} 页商品数据。`)
        }
      } catch (error) {
        if (isAbortError(error)) throw error
        if (error instanceof SellerSpriteAuthenticationError) throw error

        onProgress(
          `[错误] ${indent}  ❌ Page ${page} 抓取失败，任务已熔断: ${getErrorMessage(error)}`
        )
        throw error
      }
    }
  }

  private async getQuickViewData(
    products: Array<{ asin: string }>,
    indent: string,
    onProgress: CrawlerProgressHandler,
    signal?: AbortSignal
  ): Promise<SellerSpriteQuickViewResponse | null> {
    const asins = products.map((product) => product.asin).filter(Boolean)
    if (asins.length === 0) return null

    onProgress(
      `[DFS] ${indent}  卖家精灵: 🔍 正在请求竞品分析接口获取该页 ${asins.length} 个商品的详细参数...`
    )

    try {
      const quickViewData = await sellerSpriteSessionService.fetchQuickViewWithRetry(
        asins,
        onProgress,
        signal
      )
      onProgress(
        `[DFS] ${indent}  卖家精灵: ✅ 成功获取该页商品的竞品分析数据！(Items: ${quickViewData.data?.items?.length || 0})`
      )
      return quickViewData
    } catch (error) {
      if (isAbortError(error)) throw error
      if (error instanceof SellerSpriteAuthenticationError) {
        onProgress(
          `[错误] ${indent}  卖家精灵: 授权登录流程失败，可用账号可能已耗尽，采集任务即将终止。`
        )
        throw error
      }

      onProgress(
        `[警告] ${indent}  卖家精灵: ❌ 获取竞品分析数据失败，本页将仅写入亚马逊基础数据: ${getErrorMessage(error)}`
      )
      return null
    }
  }

  private async getSubCategories(
    category: AmazonCategory,
    cookies: string,
    currentDepth: number,
    indent: string,
    onProgress: CrawlerProgressHandler,
    signal?: AbortSignal
  ): Promise<AmazonCategory[]> {
    try {
      const html = await amazonClient.fetchHtml(category.href, cookies, signal)
      this.throwIfCancelled(signal)
      const categories = parseBestsellerChildCategories(html, category.href)

      if (categories.length > 0) {
        onProgress(`[DFS] ${indent}  🌿 成功解析到下级子分类 ${categories.length} 个`)
      } else if (currentDepth === CRAWLER_FIRST_LEVEL_DEPTH) {
        throw new AmazonRiskControlError('一级分类未解析到任何子分类，可能已进入亚马逊风控验证页')
      } else {
        onProgress(`[DFS] ${indent}  🍃 已经到达叶子节点（最深层级类目，无对应 href）`)
      }
      return categories
    } catch (error) {
      if (isAbortError(error)) throw error
      onProgress(`[错误] ${indent}  ❌ 下级子分类访问失败，任务已熔断: ${getErrorMessage(error)}`)
      throw error
    }
  }

  private notifyActivePathChange(): void {
    this.onActivePathChange(this.getActivePath())
  }

  private assertProductsParsed(productCount: number, onProgress: CrawlerProgressHandler): void {
    if (productCount > 0) {
      this.consecutiveEmptyProductPages = 0
      return
    }

    this.consecutiveEmptyProductPages++
    onProgress(
      `[警告] 亚马逊商品页连续 ${this.consecutiveEmptyProductPages}/${CRAWLER_MAX_CONSECUTIVE_EMPTY_PRODUCT_PAGES} 次解析为 0 个商品，可能已进入风控验证页。`
    )
    if (this.consecutiveEmptyProductPages >= CRAWLER_MAX_CONSECUTIVE_EMPTY_PRODUCT_PAGES) {
      throw new AmazonRiskControlError('亚马逊商品页连续返回空数据，已停止任务以避免误报完成')
    }
  }

  private throwIfCancelled(signal?: AbortSignal): void {
    throwIfAborted(signal)
    if (this.isCancelled()) throw createAbortError()
  }
}
