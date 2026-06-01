import { registerDatabaseIPC } from './database.ipc'
import { registerCrawlerIPC } from './crawler.ipc'
import { registerSellerSpriteIPC } from './sellersprite.ipc'
import { registerUpdateIPC } from './update.ipc'

/**
 * 集中注册主进程中所有的 IPC 管道监听
 * 用于完全解耦并模块化管理渲染进程发送过来的进程通信请求
 */
export function registerAllIPC(): void {
  registerDatabaseIPC()
  registerCrawlerIPC()
  registerSellerSpriteIPC()
  registerUpdateIPC()
  console.log('[IPC] 数据库、爬虫、卖家精灵与更新服务的所有 IPC 消息管道注册完毕。')
}
