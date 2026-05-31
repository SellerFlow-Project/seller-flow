import type { CrawlTaskConfig } from '../types/crawler'
import { sendCrawlerLog } from '../utils/window-bus'
import { crawlerService } from '../services/crawler.service'
import { handleIpc } from './ipc-handler'

/**
 * 爬虫任务模块 IPC 监听注册
 * 负责接收渲染进程发送的异步采集开关请求，并与 CrawlerService 通信
 */
export function registerCrawlerIPC(): void {
  // 启动抓取任务 (优化为非阻塞异步后台线程启动，防止 UI 渲染层发生卡死等待)
  handleIpc('crawler:start-task', (_event, config: CrawlTaskConfig) => {
    crawlerService
      .startTask(config, (log) => {
        sendCrawlerLog(log)
      })
      .catch((error) => {
        console.error('[IPC] 异步后台爬虫任务执行失败:', error)
      })

    return { success: true }
  })

  handleIpc('crawler:stop-task', () => {
    crawlerService.stopTask()
    return { success: true }
  })

  handleIpc('crawler:get-status', () => {
    return { success: true, ...crawlerService.getStatus(), ...crawlerService.getDfsState() }
  })

  // 从亚马逊获取最新的配送地址 Cookie 并链式抓取排行榜页面数据 (支持指定站点)
  handleIpc('crawler:get-amazon-cookies', async (_event, args?: { marketplace?: string }) => {
    const marketplace = args?.marketplace || 'JP'
    console.log(`[IPC] 开始链式调试：动态 Cookie 交换 -> 抓取 ${marketplace} 排行榜 HTML 报文`)

    const cookieResult = await crawlerService.getAmazonCookies(marketplace)
    console.log(`[IPC] 携带 Cookie 启动 ${marketplace} 排行榜拉取...`)

    const pageResult = await crawlerService.fetchBestSellersPage(cookieResult.cookies, marketplace)

    return {
      success: cookieResult.success && pageResult.success,
      cookies: cookieResult.cookies,
      address: cookieResult.address,
      error: cookieResult.error || pageResult.error,
      htmlLength: pageResult.htmlLength,
      htmlSnippet: pageResult.htmlSnippet,
      isJapanese: pageResult.isJapanese,
      categories: pageResult.categories
    }
  })
}
