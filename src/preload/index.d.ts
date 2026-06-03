import { ElectronAPI } from '@electron-toolkit/preload'
import type { AccountApi } from '../shared/account'
import type { DataSharingApi } from '../shared/data-sharing'
import type { SettingsApi } from '../shared/settings'
import type { AppUpdateApi } from '../shared/update'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      account: AccountApi
      dataSharing: DataSharingApi
      settings: SettingsApi
      updates: AppUpdateApi
    }
    webFrame: {
      setZoomFactor: (factor: number) => void
    }
  }
}
