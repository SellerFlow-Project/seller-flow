import * as cheerio from 'cheerio'
import {
  AMAZON_CRAWL_DELAY_MS,
  AMAZON_MAX_DFS_DEPTH,
  AMAZON_USER_AGENT,
  createAmazonHtmlHeaders,
  resolveAmazonMarketplace
} from '../config/amazon'
import type {
  AmazonBestSellersPageResult,
  AmazonCategory,
  AmazonCookieResult
} from '../types/amazon'
import type {
  CrawlerProgressHandler,
  CrawlerStatus,
  CrawlTaskConfig,
  DfsPathNode,
  DfsState
} from '../types/crawler'
import type { SellerSpriteQuickViewResponse } from '../types/sellersprite'
import { getErrorMessage } from '../utils/error'
import { createCompactTimestamp, sleep } from '../utils/time'
import { logAndSendCrawlerLog, sendToFirstWindow } from '../utils/window-bus'
import {
  parseAmazonBestSellerHtml,
  parseAmazonPagination,
  parseBestsellerCategories as parseAmazonBestsellerCategories,
  parseBestsellerChildCategories as parseAmazonBestsellerChildCategories
} from './crawler/amazon-parser'
import {
  SellerSpriteAuthenticationError,
  SellerSpriteRetryExhaustedError
} from './crawler/errors'
import { mergeProductsWithSellerSpriteDetails } from './crawler/sellersprite-enrichment'
import { databaseService } from './database.service'
import { sellerSpriteService } from './sellersprite.service'

export { parseAmazonBestSellerHtml } from './crawler/amazon-parser'

/**
 * 亚马逊商品流核心爬虫服务 (Main 进程)
 */
class CrawlerService {
  private activeTask: CrawlTaskConfig | null = null
  private isRunning = false
  private isCancelled = false
  private defaultUserAgent = AMAZON_USER_AGENT
  private visitedUrls: Set<string> = new Set()
  private crawlDelay = AMAZON_CRAWL_DELAY_MS // 每次请求间延时 1.5 秒

  // 💡 DFS 实时拓扑状态字段 (用于回传给渲染进程，实时画图)
  private firstLevelCatsList: string[] = []
  private completedPrimaries: Set<string> = new Set()
  private activeDfsPath: DfsPathNode[] = []

  /**
   * 广播当前的 DFS 拓扑状态至渲染进程，用于实时 Mermaid 式拓扑图渲染
   */
  private broadcastState(): void {
    sendToFirstWindow('crawler:state-update', this.getDfsState())
  }

  /**
   * 向 UI 渲染端发送实时日志
   */
  private sendLog(log: string): void {
    logAndSendCrawlerLog(log)
  }

  private sleep(ms: number): Promise<void> {
    return sleep(ms)
  }

  /**
   * 从亚马逊日本站获取最新的配送地址 Cookie (定位修改为东京 169-0074)
   */
  public async getAmazonCookies(marketplace: string = 'JP'): Promise<AmazonCookieResult> {
    const marketplaceConfig = resolveAmazonMarketplace(marketplace)
    const { domain, zipCode, fallbackCountry, ubidCookieName } = marketplaceConfig

    this.sendLog(`[系统] 正在进行 ${marketplace} 站点配送地址安全 Cookie 动态握手交换...`)

    try {
      const resSessionId = await fetch(`https://${domain}/s?k=cat`, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'User-Agent': this.defaultUserAgent,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
      })

      if (!resSessionId.ok) {
        throw new Error(`首页访问失败: HTTP ${resSessionId.status}`)
      }

      const setCookies1 = resSessionId.headers.getSetCookie()
      const cookieMap: Record<string, string> = {}
      let sessionId = ''

      setCookies1.forEach((cookieStr) => {
        const parts = cookieStr.split(';')[0].split('=')
        if (parts.length >= 2) {
          const key = parts[0].trim()
          const val = parts[1].trim()
          cookieMap[key] = val
          if (key === 'session-id') sessionId = val
        }
      })

      const cookieHeader1 = Object.entries(cookieMap)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')

      const text1 = await resSessionId.text()
      const match1 = text1.match(/&quot;anti-csrftoken-a2z&quot;:&quot;(.*?)&quot;/)
      const sourceCsrfToken = match1 ? match1[1] : ''

      let csrfToken = ''
      try {
        const resAddressSelections = await fetch(
          `https://${domain}/portal-migration/hz/glow/get-rendered-address-selections?deviceType=desktop&pageType=Search&storeContext=NoStoreName&actionSource=desktop-modal`,
          {
            headers: {
              'Content-Type': 'text/html;charset=UTF-8',
              Referer: `https://${domain}/s?k=cat`,
              'User-Agent': this.defaultUserAgent,
              Cookie: cookieHeader1,
              'anti-csrftoken-a2z': sourceCsrfToken
            }
          }
        )

        const text2 = await resAddressSelections.text()
        const match2 = text2.match(/CSRF_TOKEN\s*:\s*"([^"]+)"/)
        if (match2) {
          csrfToken = match2[1]
        }
      } catch {
        // 忽略
      }

      const resUbid = await fetch(
        `https://${domain}/portal-migration/hz/glow/address-change?actionSource=glow`,
        {
          method: 'POST',
          body: JSON.stringify({
            locationType: 'LOCATION_INPUT',
            zipCode: zipCode,
            deviceType: 'web',
            storeContext: 'hpc',
            pageType: 'Detail',
            actionSource: 'glow'
          }),
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': this.defaultUserAgent,
            Cookie: cookieHeader1,
            'anti-csrftoken-a2z': csrfToken
          }
        }
      )

      if (!resUbid.ok) {
        throw new Error(`地址修改请求失败: HTTP ${resUbid.status}`)
      }

      const setCookies2 = resUbid.headers.getSetCookie()
      let ubid = ''
      setCookies2.forEach((cookieStr) => {
        const parts = cookieStr.split(';')[0].split('=')
        if (parts.length >= 2) {
          const key = parts[0].trim()
          const val = parts[1].trim()
          if (key.startsWith('ubid-')) ubid = val
        }
      })

      if (!sessionId || !ubid) {
        throw new Error('必要 Cookie 信息为空')
      }

      let addressDesc = `${fallbackCountry} (未知区域)`
      try {
        const json = await resUbid.json()
        const addrData = json.address || {}
        const country = addrData.countryCode || marketplace
        const state = addrData.state || ''
        const city = addrData.city || ''
        const district = addrData.district || ''
        addressDesc = `${country} ${state} ${city} ${district}`.trim()
      } catch {
        // 忽略
      }

      const resultCookies = `${ubidCookieName}=${ubid}; session-id=${sessionId}`
      return {
        success: true,
        cookies: resultCookies,
        address: addressDesc
      }
    } catch (error) {
      const message = getErrorMessage(error)
      this.sendLog(`[警告] 动态地址 Cookie 交换异常: ${message}。启用降级方案。`)
      const backupCookies = `${ubidCookieName}=355-5685452-2837352; session-id=357-7564356-4927846`
      return {
        success: false,
        cookies: backupCookies,
        address: `${fallbackCountry} (默认备用地址)`,
        error: message
      }
    }
  }

  /**
   * 解析亚马逊最佳排行榜首页的首级分类信息
   *
   * 注意：这个方法保留你的原始逻辑，用于排行榜首页抓取首级分类。
   * 不要把它用于 DFS 子分类页面，否则会把父级、兄弟级、子级混在一起。
   */
  public parseBestsellerCategories(
    html: string,
    baseUrl = 'https://www.amazon.co.jp'
  ): AmazonCategory[] {
    return parseAmazonBestsellerCategories(html, baseUrl)
  }

  /**
   * 从当前分类页面解析“真正的下一层子分类”
   *
   * 规则：
   * 1. 先找到左侧分类树里当前选中的 li。
   * 2. 如果当前 li 下面存在直接子 ul，则只返回这个子 ul 里的直接 li > a。
   * 3. 如果当前 li 下面没有子 ul，说明当前页已经是叶子分类，返回空数组。
   *
   * 这样可以避免：
   * - 点击“女演员”页面时，把同级“男演员”误判为“女演员”的子分类。
   * - DFS 拓扑图里出现“女演员 -> 男演员”的错误层级。
   */
  public parseBestsellerChildCategories(
    html: string,
    currentUrl = 'https://www.amazon.co.jp'
  ): AmazonCategory[] {
    return parseAmazonBestsellerChildCategories(html, currentUrl)
  }

  /**
   * 获取排行榜页面数据及分类列表 (提供给调试按钮)
   */
  public async fetchBestSellersPage(cookies: string, marketplace: string = 'JP'): Promise<AmazonBestSellersPageResult> {
    try {
      const marketplaceConfig = resolveAmazonMarketplace(marketplace)
      const targetUrl = `${marketplaceConfig.baseUrl}/ranking?type=top-sellers&ref_=nav_cs_bestsellers`
      const html = await this.fetchHtml(targetUrl, cookies)
      const isJapanese =
        html.includes('売れ筋') ||
        html.includes('ランキング') ||
        html.includes('bestsellers') ||
        html.includes('Best Sellers')

      const categories = this.parseBestsellerCategories(html, marketplaceConfig.baseUrl)

      return {
        success: true,
        htmlLength: html.length,
        htmlSnippet: html.substring(0, 500) + '\n... [HTML 数据流已截止] ...',
        isJapanese,
        categories
      }
    } catch (error) {
      return {
        success: false,
        htmlLength: 0,
        htmlSnippet: '',
        isJapanese: false,
        categories: [],
        error: getErrorMessage(error)
      }
    }
  }

  /**
   * 独立的页面 HTML 抓取
   */
  public async fetchHtml(url: string, cookies: string): Promise<string> {
    const response = await fetch(url, {
      headers: createAmazonHtmlHeaders(cookies)
    })

    if (!response.ok) {
      throw new Error(`页面抓取异常: HTTP ${response.status}`)
    }

    return await response.text()
  }

  /**
   * 核心算法：递归深度优先搜索 (DFS) 分类树，支持无限深度分页商品爬取
   */
  private async traverseCategoryDfs(
    category: AmazonCategory,
    cookies: string,
    currentDepth: number,
    taskId: number,
    onProgress: CrawlerProgressHandler
  ): Promise<void> {
    if (this.isCancelled) return

    // 避免循环抓取，记录已访问 URL
    if (this.visitedUrls.has(category.href)) {
      return
    }
    this.visitedUrls.add(category.href)

    // 💡 DFS 实时状态追踪：压入当前路径栈
    this.activeDfsPath.push({ name: category.name, depth: currentDepth })
    this.broadcastState()

    const indent = '  '.repeat(currentDepth - 1)
    onProgress(`[DFS] ${indent}➡️ 访问分类: [${category.name}] | URL: ${category.href}`)

    try {
      // 💡 规则：首级分类无需获取商品数据，只有二级及更深层子分类才需要获取商品
      const isFirstLevel = currentDepth === 1

      if (!isFirstLevel) {
        let currentPageUrl = category.href
        let pageNum = 1
        let hasMore = true

        // 根据用户分页逻辑，循环拉取商品直到没有下一页
        while (hasMore && !this.isCancelled) {
          onProgress(`[DFS] ${indent}  📥 正在抓取商品列表 (Page ${pageNum})...`)

          try {
            const html = await this.fetchHtml(currentPageUrl, cookies)

            // 运行用户提供的高解析力 BestSeller HTML 商品解析器
            const products = parseAmazonBestSellerHtml(html)
            onProgress(
              `[DFS] ${indent}  ✅ Page ${pageNum} 成功！获取到 ${products.length} 个排名商品`
            )

            let quickViewData: SellerSpriteQuickViewResponse | null = null
            if (products.length > 0) {
              const asins = products.map((p) => p.asin).filter(Boolean)
              if (asins.length > 0) {
                onProgress(
                  `[DFS] ${indent}  卖家精灵: 🔍 正在请求竞品分析接口获取该页 ${asins.length} 个商品的详细参数...`
                )
                try {
                  quickViewData = await this.fetchSellerSpriteQuickViewWithRetry(asins, onProgress)
                  onProgress(
                    `[DFS] ${indent}  卖家精灵: ✅ 成功获取该页商品的竞品分析数据！(Items: ${quickViewData.data?.items?.length || 0})`
                  )
                } catch (spriteErr) {
                  if (spriteErr instanceof SellerSpriteAuthenticationError) {
                    onProgress(
                      `[错误] ${indent}  卖家精灵: 授权登录流程失败，可用账号可能已耗尽，采集任务即将终止。`
                    )
                    throw spriteErr
                  }

                  onProgress(
                    `[警告] ${indent}  卖家精灵: ❌ 获取竞品分析数据失败，本页将仅写入亚马逊基础数据: ${getErrorMessage(spriteErr)}`
                  )
                }
              }
            }

            if (products.length > 0) {
              const fullCategoryPath = this.activeDfsPath.map((node) => node.name).join(' > ')
              const productsToPersist = mergeProductsWithSellerSpriteDetails(products, quickViewData)
              const enrichedCount = productsToPersist.filter((item) => item.sellerSprite).length
              databaseService.insertProducts(taskId, productsToPersist, fullCategoryPath)
              onProgress(
                `[数据] ${indent}    💾 [写入DB] 本页已入库 ${products.length} 个商品，其中 ${enrichedCount} 个包含卖家精灵数据。`
              )
            } else {
              onProgress(`[数据] ${indent}    💾 [写入DB] 本页无商品可写入。`)
            }

            // 运行用户提供的高精度 pagination 翻页解析器
            const $ = cheerio.load(html)
            const pagination = parseAmazonPagination($, currentPageUrl)

            if (pagination.hasNextPage && pagination.nextPageUrl) {
              currentPageUrl = pagination.nextPageUrl
              pageNum = pagination.currentPage ? pagination.currentPage + 1 : pageNum + 1
              hasMore = true
              onProgress(`[DFS] ${indent}  🏷️ 检索到下一页链接，延时准备加载...`)
            } else {
              hasMore = false
              onProgress(`[DFS] ${indent}  🏁 商品分页抓取完毕，共拉取 ${pageNum} 页商品数据。`)
            }
          } catch (error) {
            if (error instanceof SellerSpriteAuthenticationError) {
              throw error
            }

            onProgress(`[警告] ${indent}  ❌ Page ${pageNum} 抓取失败: ${getErrorMessage(error)}`)
            hasMore = false
          }

          // 翻页友好延时，保护网关
          if (hasMore && !this.isCancelled) {
            await this.sleep(this.crawlDelay)
          }
        }
      } else {
        onProgress(
          `[DFS] ${indent}  ℹ️ 首级主分类仅作为导航入口，跳过商品下载，开始向下递归子分类...`
        )
      }

      // 2. 获取当前分类下的下一层级子分类列表 (分类解析规则和首级相同)
      let subCategories: AmazonCategory[] = []
      try {
        const pageHtml = await this.fetchHtml(category.href, cookies)
        subCategories = this.parseBestsellerChildCategories(pageHtml, category.href)

        if (subCategories.length > 0) {
          onProgress(`[DFS] ${indent}  🌿 成功解析到下级子分类 ${subCategories.length} 个`)
        } else {
          onProgress(`[DFS] ${indent}  🍃 已经到达叶子节点（最深层级类目，无对应 href）`)
        }
      } catch (error) {
        onProgress(`[警告] ${indent}  ❌ 下级子分类解析发生异常: ${getErrorMessage(error)}`)
      }

      // 间歇安全延时
      if (subCategories.length > 0 && !this.isCancelled) {
        await this.sleep(this.crawlDelay)
      }

      // 3. 递归向下进行深度优先遍历 (最大允许遍历深度设为 10 级以进行风控防范)
      for (const sub of subCategories) {
        if (this.isCancelled) return

        if (currentDepth < AMAZON_MAX_DFS_DEPTH) {
          await this.traverseCategoryDfs(sub, cookies, currentDepth + 1, taskId, onProgress)
        }
      }
    } finally {
      // 下面注释掉的代码 **不要删除**
      // // 💡 DFS 实时状态追踪：回退时弹出当前路径栈，保证前台视图 100% 正确渲染
      // this.activeDfsPath = this.activeDfsPath.filter((x) => x.name !== category.name)
      // 💡 DFS 实时状态追踪：回退时弹出当前路径栈，使用 pop() 保证先进后出，避免同名分类被误删
      this.activeDfsPath.pop()
      this.broadcastState()
    }
  }

  /**
   * 获取当前的实时爬取拓扑状态 (用于 UI 页面挂载时同步)
   */
  public getDfsState(): DfsState {
    return {
      firstLevelCats: this.firstLevelCatsList,
      completedPrimaries: Array.from(this.completedPrimaries),
      activePath: this.activeDfsPath,
      isCrawling: this.isRunning
    }
  }

  /**
   * 启动任务接口
   */
  public async startTask(
    config: CrawlTaskConfig,
    onProgress: CrawlerProgressHandler
  ): Promise<void> {
    if (this.isRunning) {
      throw new Error('当前已有正在执行的爬虫任务！')
    }

    // 💡 判断数据库中是否有可用的卖家精灵账号
    const spriteAccounts = databaseService.querySpriteAccounts()
    const activeAccounts = spriteAccounts.filter((acc) => acc.status === 'normal')
    if (activeAccounts.length === 0) {
      onProgress(
        `[错误] 启动任务失败：本地 SQLite 数据库中没有可用的“正常”状态卖家精灵账号，请先添加账号！`
      )
      throw new Error('没有可用的卖家精灵账号，禁止启动采集任务！')
    }

    this.isRunning = true
    this.isCancelled = false
    this.visitedUrls.clear()
    this.activeTask = config

    // 初始化拓扑状态
    this.firstLevelCatsList = []
    this.completedPrimaries.clear()
    this.activeDfsPath = []
    this.broadcastState()

    // 💡 验证任务类型：仅支持排行榜采集，其余报错阻断
    if (config.taskType !== 'best_sellers') {
      onProgress(
        `[错误] 启动任务失败：系统当前仅支持 "排行榜采集" (Best Sellers) 类型，暂不支持您选择的任务类型！`
      )
      this.isRunning = false
      this.activeTask = null
      this.broadcastState()
      throw new Error('暂不支持该采集任务类型')
    }

    const taskName = createCompactTimestamp()

    // 💡 写入本地 SQLite 数据库任务表
    let taskId = 0
    try {
      taskId = databaseService.createTask(taskName, config.taskType, config.marketplace)
    } catch (dbErr) {
      onProgress(`[错误] 写入 SQLite 任务日志失败: ${getErrorMessage(dbErr)}`)
      this.isRunning = false
      this.activeTask = null
      this.broadcastState()
      throw dbErr
    }

    const marketplace = config.marketplace || 'JP'
    const marketplaceConfig = resolveAmazonMarketplace(marketplace)

    onProgress(
      `[开始] 启动亚马逊智能爬虫系统... 任务名称: ${taskName} | 站点: ${marketplaceConfig.siteName} | 核心策略: "递归降级深度遍历 (DFS)"`
    )

    try {
      // 1. 获取对应站点的定位 Cookie 凭证
      const cookieRes = await this.getAmazonCookies(marketplace)
      onProgress(`[成功] 获得 ${marketplace} 站点 Cookie 凭证。当前配送地址: ${cookieRes.address}`)

      // 2. 获取顶级排行榜的全部首级分类
      let firstLevelCats: AmazonCategory[] = []
      if (config.selectedCategories && config.selectedCategories.length > 0) {
        onProgress(`[系统] 使用用户自定义调整后的首级分类列表 (共 ${config.selectedCategories.length} 个)...`)
        firstLevelCats = config.selectedCategories
      } else {
        onProgress(`[首级] 正在读取 ${marketplaceConfig.siteName} 排行榜顶级核心主分类...`)
        const startUrl = `${marketplaceConfig.baseUrl}/ranking?type=top-sellers&ref_=nav_cs_bestsellers`
        const rootHtml = await this.fetchHtml(startUrl, cookieRes.cookies)

        // 解析首级分类时，传入站点的 base_url 确保生成的链接正确
        const baseUrl = marketplaceConfig.baseUrl
        firstLevelCats = this.parseBestsellerCategories(rootHtml, baseUrl)
      }

      this.firstLevelCatsList = firstLevelCats.map((c) => c.name)
      this.broadcastState()

      onProgress(
        `[成功] 成功检索到 ${firstLevelCats.length} 个首级核心分类目录，开始启动 DFS 深度迭代爬网...`
      )

      // 3. 启动深度优先遍历 (DFS)
      for (const firstLevelCat of firstLevelCats) {
        if (this.isCancelled) break

        onProgress(`[首级] 🚀 开始处理一级分类线: [${firstLevelCat.name}]`)
        await this.traverseCategoryDfs(firstLevelCat, cookieRes.cookies, 1, taskId, onProgress)

        // 标记一级分类处理完毕
        this.completedPrimaries.add(firstLevelCat.name)
        this.broadcastState()

        onProgress(`[回溯] 🟢 一级分类线 [${firstLevelCat.name}] 处理完毕，回滚回顶层目录。`)
      }

      if (this.isCancelled) {
        onProgress('[终止] 后台爬取任务已被手动终止。')
        if (taskId) databaseService.updateTaskStatus(taskId, 'cancelled')
      } else {
        onProgress('[完成] 🎉 亚马逊排行榜全级分类深度优先遍历 (DFS) 商品抓取任务已全部圆满完成！')
        if (taskId) databaseService.updateTaskStatus(taskId, 'completed')
      }
    } catch (error) {
      onProgress(`[错误] 任务爬取异常终止: ${getErrorMessage(error)}`)
      if (taskId) databaseService.updateTaskStatus(taskId, 'failed')
    } finally {
      this.isRunning = false
      this.isCancelled = false
      this.activeTask = null
      this.broadcastState()
    }
  }

  /**
   * 停止当前执行的爬虫流
   */
  public stopTask(): void {
    if (!this.isRunning) return
    this.isCancelled = true
    this.activeTask = null
    console.log(`[CrawlerService] 发送手动强退信号。`)
  }

  /**
   * 自动获取并维护卖家精灵的会话 Token，处理失效重登、备用账号轮询与状态更新
   * @param onProgress 日志广播回调
   */
  private async ensureSellerSpriteSession(onProgress: (log: string) => void): Promise<string> {
    // 1. 如果当前已经缓存了有效的 token，先尝试使用
    const currentToken = sellerSpriteService.getAuthToken()
    if (currentToken) {
      return currentToken
    }

    // 2. 如果没有 token，我们需要从数据库中获取可用账号并进行登录
    return await this.performSellerSpriteRotateLogin(onProgress)
  }

  /**
   * 轮换数据库中的卖家精灵正常账号进行联机登录
   */
  private async performSellerSpriteRotateLogin(onProgress: (log: string) => void): Promise<string> {
    const accounts = databaseService.querySpriteAccounts().filter((acc) => acc.status === 'normal')
    if (accounts.length === 0) {
      onProgress(`[卖家精灵] ❌ 失败：数据库中已无正常状态的卖家精灵账号！`)
      throw new SellerSpriteAuthenticationError('No available SellerSprite accounts')
    }

    for (const acc of accounts) {
      onProgress(`[卖家精灵] 👤 尝试使用账号 [${acc.username}] 进行登录授权...`)

      let loginSuccess = false
      let token = ''
      let attempt = 1
      const maxAttempts = 3

      while (attempt <= maxAttempts) {
        const loginRes = await sellerSpriteService.login(acc.username, acc.password)

        if (loginRes.success === true) {
          token = loginRes.token || ''
          loginSuccess = true
          onProgress(`[卖家精灵] 🎉 账号 [${acc.username}] 登录成功！已获取并缓存会话 Auth-Token`)
          break
        } else if (loginRes.success === 2) {
          // 网络异常，进行重试
          onProgress(
            `[卖家精灵] ⚠️ 账号 [${acc.username}] 登录时遭遇网络异常 (Attempt ${attempt}/${maxAttempts}): ${loginRes.message}`
          )
          attempt++
          if (attempt <= maxAttempts) {
            await this.sleep(2000) // 延迟 2 秒后重试
          }
        } else {
          // 账号凭证错误 (success === 1)
          onProgress(`[卖家精灵] ❌ 账号 [${acc.username}] 凭证失效或密码错误：${loginRes.message}`)
          try {
            databaseService.updateSpriteAccountStatus(acc.id, 'invalid')
            onProgress(`[数据库] 🔴 已将失效账号 [${acc.username}] 状态自动标记为「已失效」`)
          } catch (dbErr) {
            onProgress(`[数据库] 警告：标记账号状态失败: ${getErrorMessage(dbErr)}`)
          }
          break // 凭证错误，无需重试，直接尝试下一个账号
        }
      }

      if (loginSuccess && token) {
        sellerSpriteService.setAuthToken(token)
        return token
      }

      if (!loginSuccess && attempt > maxAttempts) {
        onProgress(`[卖家精灵] ⚠️ 账号 [${acc.username}] 连续 3 次网络异常，跳过此账号。`)
      }
    }

    onProgress(`[卖家精灵] ❌ 严重错误：数据库中所有的正常卖家精灵账号均登录失败，无法完成授权！`)
    throw new SellerSpriteAuthenticationError('All SellerSprite accounts failed to authenticate')
  }

  /**
   * 自动带签名、自动授权、自动账号轮换地查询卖家精灵快速竞品数据
   */
  private async fetchSellerSpriteQuickViewWithRetry(
    asins: string[],
    onProgress: (log: string) => void
  ): Promise<SellerSpriteQuickViewResponse> {
    let token = await this.ensureSellerSpriteSession(onProgress)

    let attempt = 1
    const maxRetries = 2

    while (attempt <= maxRetries) {
      const res = await sellerSpriteService.getQuickViewJP(asins, token)

      if (res.success && res.data) {
        const code = res.data.code

        if (code === 'OK') {
          return res.data
        } else if (code === 'ERR_NEED_RE_AUTHORIZED') {
          onProgress(
            `[卖家精灵] 🔑 会话 Auth-Token 已失效 (ERR_NEED_RE_AUTHORIZED)，正在触发自动重新登录轮换机制...`
          )
          sellerSpriteService.setAuthToken('')
          token = await this.performSellerSpriteRotateLogin(onProgress)
          attempt++
        } else {
          onProgress(
            `[卖家精灵] ⚠️ 请求接口返回异常 code [${code}]: ${res.data.message || '未知错误'}`
          )
          throw new Error(`SellerSprite API error code: ${code}`)
        }
      } else {
        onProgress(
          `[卖家精灵] ⚠️ 网络连接异常或服务无响应 (Attempt ${attempt}/${maxRetries}): ${res.error || '未知错误'}`
        )
        attempt++
        if (attempt <= maxRetries) {
          await this.sleep(2000)
        } else {
          throw new SellerSpriteRetryExhaustedError(
            res.error || 'SellerSprite network connection failed'
          )
        }
      }
    }

    throw new SellerSpriteRetryExhaustedError(
      'Failed to fetch SellerSprite quick view after re-authorization'
    )
  }

  /**
   * 检测任务状态
   */
  public getStatus(): CrawlerStatus {
    return {
      isRunning: this.isRunning,
      config: this.activeTask
    }
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
