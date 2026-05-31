import { DEFAULT_AMAZON_MARKETPLACE } from '../config/amazon'
import { IPC_CHANNEL } from '../config/ipc'
import type { CrawlTaskConfig } from '../types/crawler'
import { sendCrawlerLog } from '../utils/window-bus'
import { crawlerService } from '../services/crawler.service'
import { createIpcSuccess, handleIpc } from './ipc-handler'

/**
 * 爬虫任务模块 IPC 监听注册
 * 负责接收渲染进程发送的异步采集开关请求，并与 CrawlerService 通信
 */
export function registerCrawlerIPC(): void {
  // 启动抓取任务 (优化为非阻塞异步后台线程启动，防止 UI 渲染层发生卡死等待)
  handleIpc(IPC_CHANNEL.CRAWLER.START_TASK, (_event, config: CrawlTaskConfig) => {
    const result = crawlerService.startTask(config, (log) => {
      sendCrawlerLog(log)
    })
    return createIpcSuccess(result)
  })

  handleIpc(IPC_CHANNEL.CRAWLER.STOP_TASK, () => {
    return createIpcSuccess(crawlerService.stopTask())
  })

  handleIpc(IPC_CHANNEL.CRAWLER.GET_STATUS, () => {
    return createIpcSuccess({ ...crawlerService.getStatus(), ...crawlerService.getDfsState() })
  })

  // 从亚马逊获取最新的配送地址 Cookie 并链式抓取排行榜页面数据 (支持指定站点)
  handleIpc(
    IPC_CHANNEL.CRAWLER.GET_AMAZON_COOKIES,
    async (_event, args?: { marketplace?: string }) => {
      const marketplace = args?.marketplace || DEFAULT_AMAZON_MARKETPLACE
      console.log(`[IPC] 开始链式调试：动态 Cookie 交换 -> 抓取 ${marketplace} 排行榜 HTML 报文`)

      const cookieResult = await crawlerService.getAmazonCookies(marketplace)
      console.log(`[IPC] 携带 Cookie 启动 ${marketplace} 排行榜拉取...`)

      const pageResult = await crawlerService.fetchBestSellersPage(
        cookieResult.cookies,
        marketplace
      )

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
    }
  )
}
