import { IPC_CHANNEL } from '../config/ipc'
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateState,
  quitAndInstallUpdate
} from '../services/update.service'
import { handleIpc } from './ipc-handler'

export function registerUpdateIPC(): void {
  handleIpc(IPC_CHANNEL.UPDATE.GET_STATE, () => getUpdateState())
  handleIpc(IPC_CHANNEL.UPDATE.CHECK, () => checkForUpdates())
  handleIpc(IPC_CHANNEL.UPDATE.DOWNLOAD, () => downloadUpdate())
  handleIpc(IPC_CHANNEL.UPDATE.QUIT_AND_INSTALL, () => quitAndInstallUpdate())
}
