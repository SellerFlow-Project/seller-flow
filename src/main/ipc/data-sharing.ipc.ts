import { IPC_CHANNEL } from '../config/ipc'
import { dataSharingService } from '../services/data-sharing.service'
import { handleIpc } from './ipc-handler'
import type { DataSharingProductQueryFilter, SharedDataSource } from '../../shared/data-sharing'

export function registerDataSharingIPC(): void {
  handleIpc(IPC_CHANNEL.DATA_SHARING.GET_STATUS, () => dataSharingService.getStatus())
  handleIpc(IPC_CHANNEL.DATA_SHARING.DISCOVER_SOURCES, () => dataSharingService.discoverSources())
  handleIpc<[SharedDataSource], unknown[]>(
    IPC_CHANNEL.DATA_SHARING.GET_REMOTE_TASKS,
    (_event, source) => dataSharingService.getRemoteTasks(source)
  )
  handleIpc<[SharedDataSource, number], string[]>(
    IPC_CHANNEL.DATA_SHARING.GET_REMOTE_CATEGORIES,
    (_event, source, taskId) => dataSharingService.getRemoteCategories(source, taskId)
  )
  handleIpc<[SharedDataSource, number], string[]>(
    IPC_CHANNEL.DATA_SHARING.GET_REMOTE_SELLER_TYPES,
    (_event, source, taskId) => dataSharingService.getRemoteSellerTypes(source, taskId)
  )
  handleIpc<[SharedDataSource, DataSharingProductQueryFilter], { total: number; list: unknown[] }>(
    IPC_CHANNEL.DATA_SHARING.QUERY_REMOTE_PRODUCTS,
    (_event, source, filter) => dataSharingService.queryRemoteProducts(source, filter)
  )
  handleIpc<[SharedDataSource, number], unknown[]>(
    IPC_CHANNEL.DATA_SHARING.GET_REMOTE_PRODUCT_BSR_RANKS,
    (_event, source, productId) => dataSharingService.getRemoteProductBsrRanks(source, productId)
  )
}
