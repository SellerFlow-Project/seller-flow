import { registerAccountIPC } from './account.ipc'
import { registerAmazonSearchIPC } from './amazon-search.ipc'
import { registerDatabaseIPC } from './database.ipc'
import { registerDataSharingIPC } from './data-sharing.ipc'
import { registerCrawlerIPC } from './crawler.ipc'
import { registerSellerSpriteIPC } from './sellersprite.ipc'
import { registerSettingsIPC } from './settings.ipc'
import { registerUpdateIPC } from './update.ipc'
import { registerMihomoIPC } from './mihomo.ipc'
import { getSettings } from '../services/settings.service'
import { dataSharingService } from '../services/data-sharing.service'
import { mihomoService } from '../services/mihomo.service'

/**
 * 集中注册主进程中所有的 IPC 管道监听
 * 用于完全解耦并模块化管理渲染进程发送过来的进程通信请求
 */
export function registerAllIPC(): void {
  registerAccountIPC()
  registerAmazonSearchIPC()
  registerDatabaseIPC()
  registerDataSharingIPC()
  registerCrawlerIPC()
  registerSellerSpriteIPC()
  registerSettingsIPC()
  registerMihomoIPC()
  registerUpdateIPC()
  const settings = getSettings()
  void dataSharingService.applySettings(settings.dataSharing)
  void mihomoService.applySettings(settings.crawling)
  console.log(
    '[IPC] 账号、亚马逊搜索词、数据库、数据共享、Mihomo、爬虫、卖家精灵、设置与更新服务的所有 IPC 消息管道注册完毕。'
  )
}
