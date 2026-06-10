import { DATABASE_AFFECTED_ROWS } from '../config/database'
import { IPC_CHANNEL } from '../config/ipc'
import { databaseService } from '../services/database.service'
import type {
  ProductQueryFilter,
  SearchKeywordQueryFilter,
  SellerSpriteAccountStatus,
  SpriteAccountClearScope
} from '../types/database'
import { createIpcSuccess, handleIpc } from './ipc-handler'

interface DeleteProductsConditions {
  taskId?: number
}

interface CreateSpriteAccountPayload {
  username: string
  password: string
}

interface UpdateSpriteAccountStatusPayload {
  id: number
  status: SellerSpriteAccountStatus
}

/**
 * 数据库模块 IPC 监听注册
 * 负责接收渲染进程发送的数据库事务请求，并转发给 DatabaseService 运行
 */
export function registerDatabaseIPC(): void {
  handleIpc(IPC_CHANNEL.DATABASE.INIT, (_event, customPath: string) => {
    databaseService.initDatabase(customPath)
    return createIpcSuccess()
  })

  handleIpc(IPC_CHANNEL.DATABASE.GET_TASKS, () => {
    return createIpcSuccess({ list: databaseService.queryTasks() })
  })

  handleIpc(IPC_CHANNEL.DATABASE.GET_CATEGORIES, (_event, taskId: number) => {
    return createIpcSuccess({ list: databaseService.queryCategories(taskId) })
  })

  handleIpc(IPC_CHANNEL.DATABASE.GET_SELLER_TYPES, (_event, taskId: number) => {
    return createIpcSuccess({ list: databaseService.querySellerTypes(taskId) })
  })

  handleIpc(IPC_CHANNEL.DATABASE.DELETE_TASK, (_event, taskId: number) => {
    databaseService.deleteTask(taskId)
    return createIpcSuccess()
  })

  handleIpc(
    IPC_CHANNEL.DATABASE.QUERY_PRODUCTS,
    (_event, filter: ProductQueryFilter | undefined) => {
      return createIpcSuccess(databaseService.queryProducts(filter))
    }
  )

  handleIpc(IPC_CHANNEL.DATABASE.GET_PRODUCT_BSR_RANKS, (_event, productId: number) => {
    return createIpcSuccess({ list: databaseService.queryProductBsrRanks(productId) })
  })

  handleIpc(
    IPC_CHANNEL.DATABASE.QUERY_SEARCH_KEYWORDS,
    (_event, filter: SearchKeywordQueryFilter | undefined) => {
      return createIpcSuccess(databaseService.queryAmazonSearchKeywords(filter))
    }
  )

  handleIpc(IPC_CHANNEL.DATABASE.GET_SEARCH_KEYWORD_PRODUCTS, (_event, keywordId: number) => {
    return createIpcSuccess({ list: databaseService.queryAmazonSearchKeywordProducts(keywordId) })
  })

  handleIpc(IPC_CHANNEL.DATABASE.MARK_SEARCH_KEYWORD_READ, (_event, keywordId: number) => {
    return createIpcSuccess({ updated: databaseService.markAmazonSearchKeywordAsRead(keywordId) })
  })

  handleIpc(IPC_CHANNEL.DATABASE.MARK_PRODUCT_READ, (_event, productId: number) => {
    return createIpcSuccess({ updated: databaseService.markProductAsRead(productId) })
  })

  // 兼容性保留：删除商品记录 (如果有 taskId 则调用级联任务删除)
  handleIpc(
    IPC_CHANNEL.DATABASE.DELETE_PRODUCTS,
    (_event, conditions: DeleteProductsConditions | undefined) => {
      if (conditions && conditions.taskId) {
        databaseService.deleteTask(conditions.taskId)
        return createIpcSuccess({ affectedRows: DATABASE_AFFECTED_ROWS.SINGLE })
      }

      return createIpcSuccess({ affectedRows: DATABASE_AFFECTED_ROWS.NONE })
    }
  )

  handleIpc(IPC_CHANNEL.DATABASE.GET_STATISTICS, () => {
    return createIpcSuccess({ stats: databaseService.getStatistics() })
  })

  handleIpc(IPC_CHANNEL.DATABASE.GET_SPRITE_ACCOUNTS, () => {
    return createIpcSuccess({ list: databaseService.querySpriteAccounts() })
  })

  handleIpc(
    IPC_CHANNEL.DATABASE.ADD_SPRITE_ACCOUNT,
    (_event, { username, password }: CreateSpriteAccountPayload) => {
      return createIpcSuccess({ id: databaseService.createSpriteAccount(username, password) })
    }
  )

  handleIpc(IPC_CHANNEL.DATABASE.DELETE_SPRITE_ACCOUNT, (_event, id: number) => {
    databaseService.deleteSpriteAccount(id)
    return createIpcSuccess()
  })

  handleIpc(
    IPC_CHANNEL.DATABASE.CLEAR_SPRITE_ACCOUNTS,
    (_event, scope: SpriteAccountClearScope) => {
      databaseService.clearSpriteAccounts(scope)
      return createIpcSuccess()
    }
  )

  handleIpc(
    IPC_CHANNEL.DATABASE.UPDATE_SPRITE_ACCOUNT_STATUS,
    (_event, { id, status }: UpdateSpriteAccountStatusPayload) => {
      databaseService.updateSpriteAccountStatus(id, status)
      return createIpcSuccess()
    }
  )

  handleIpc(IPC_CHANNEL.DATABASE.CLEAR_CACHE, () => {
    databaseService.clearCache()
    return createIpcSuccess()
  })
}
