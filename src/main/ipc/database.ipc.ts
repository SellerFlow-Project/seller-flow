import { databaseService } from '../services/database.service'
import type { ProductQueryFilter } from '../services/database.service'
import { handleIpc } from './ipc-handler'

interface DeleteProductsConditions {
  taskId?: number
}

/**
 * 数据库模块 IPC 监听注册
 * 负责接收渲染进程发送的数据库事务请求，并转发给 DatabaseService 运行
 */
export function registerDatabaseIPC(): void {
  handleIpc('db:init', (_event, customPath: string) => {
    databaseService.initDatabase(customPath)
    return { success: true }
  })

  handleIpc('db:get-tasks', () => {
    return { success: true, list: databaseService.queryTasks() }
  })

  handleIpc('db:get-categories', (_event, taskId: number) => {
    return { success: true, list: databaseService.queryCategories(taskId) }
  })

  handleIpc('db:get-seller-types', (_event, taskId: number) => {
    return { success: true, list: databaseService.querySellerTypes(taskId) }
  })

  handleIpc('db:delete-task', (_event, taskId: number) => {
    databaseService.deleteTask(taskId)
    return { success: true }
  })

  handleIpc('db:query-products', (_event, filter: ProductQueryFilter | undefined) => {
    return { success: true, ...databaseService.queryProducts(filter) }
  })

  handleIpc('db:get-product-bsr-ranks', (_event, productId: number) => {
    return { success: true, list: databaseService.queryProductBsrRanks(productId) }
  })

  // 兼容性保留：删除商品记录 (如果有 taskId 则调用级联任务删除)
  handleIpc('db:delete-products', (_event, conditions: DeleteProductsConditions | undefined) => {
    if (conditions && conditions.taskId) {
      databaseService.deleteTask(conditions.taskId)
      return { success: true, affectedRows: 1 }
    }

    return { success: true, affectedRows: 0 }
  })

  handleIpc('db:get-statistics', () => {
    return { success: true, stats: databaseService.getStatistics() }
  })

  handleIpc('db:get-sprite-accounts', () => {
    return { success: true, list: databaseService.querySpriteAccounts() }
  })

  handleIpc('db:add-sprite-account', (_event, { username, password }) => {
    return { success: true, id: databaseService.createSpriteAccount(username, password) }
  })

  handleIpc('db:delete-sprite-account', (_event, id: number) => {
    databaseService.deleteSpriteAccount(id)
    return { success: true }
  })

  handleIpc('db:clear-sprite-accounts', (_event, scope: 'all' | 'invalid') => {
    databaseService.clearSpriteAccounts(scope)
    return { success: true }
  })

  handleIpc('db:update-sprite-account-status', (_event, { id, status }) => {
    databaseService.updateSpriteAccountStatus(id, status)
    return { success: true }
  })

  handleIpc('db:clear-cache', () => {
    databaseService.clearCache()
    return { success: true }
  })
}
