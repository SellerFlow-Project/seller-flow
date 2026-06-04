import { IPC_CHANNEL } from '../config/ipc'
import { mihomoService } from '../services/mihomo.service'
import { getCrawlingSettings } from '../services/settings.service'
import { handleIpc } from './ipc-handler'

export function registerMihomoIPC(): void {
  handleIpc(IPC_CHANNEL.MIHOMO.GET_STATUS, () => mihomoService.getStatus())
  handleIpc(IPC_CHANNEL.MIHOMO.LIST_NODES, () => mihomoService.listNodes())
  handleIpc(IPC_CHANNEL.MIHOMO.REFRESH_SUBSCRIPTION, async () => {
    return await mihomoService.refreshSubscription(getCrawlingSettings())
  })
  handleIpc(IPC_CHANNEL.MIHOMO.TEST_NODE, async (_event, nodeId: string) => {
    return await mihomoService.testNode(nodeId)
  })
}
