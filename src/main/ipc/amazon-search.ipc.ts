import { IPC_CHANNEL } from '../config/ipc'
import { amz123Service } from '../services/amz123.service'
import { amazonSearchService } from '../services/amazon-search.service'
import { createIpcSuccess, handleIpc } from './ipc-handler'
import type { AmazonSearchConfig } from '../../shared/amazon-search'

export function registerAmazonSearchIPC(): void {
  handleIpc(IPC_CHANNEL.AMAZON_SEARCH.GET_LOCAL_STATE, () => {
    return createIpcSuccess(amazonSearchService.getLocalState())
  })

  handleIpc(IPC_CHANNEL.AMAZON_SEARCH.SAVE_CONFIG, (_event, config: AmazonSearchConfig) => {
    return createIpcSuccess(amazonSearchService.saveConfig(config))
  })

  handleIpc(IPC_CHANNEL.AMAZON_SEARCH.REQUEST_LOGIN_CODE, async () => {
    return createIpcSuccess(await amz123Service.requestLoginCode())
  })

  handleIpc(IPC_CHANNEL.AMAZON_SEARCH.POLL_LOGIN_STATUS, async (_event, ticket: string) => {
    return createIpcSuccess(await amz123Service.pollLoginStatus(ticket))
  })

  handleIpc(IPC_CHANNEL.AMAZON_SEARCH.LOGOUT, () => {
    amazonSearchService.logout()
    return createIpcSuccess()
  })

  handleIpc(IPC_CHANNEL.AMAZON_SEARCH.START_TASK, (_event, config: AmazonSearchConfig) => {
    return createIpcSuccess(amazonSearchService.startTask(config))
  })

  handleIpc(IPC_CHANNEL.AMAZON_SEARCH.STOP_TASK, () => {
    return createIpcSuccess(amazonSearchService.stopTask())
  })

  handleIpc(IPC_CHANNEL.AMAZON_SEARCH.GET_STATUS, () => {
    return createIpcSuccess(amazonSearchService.getStatus())
  })
}
