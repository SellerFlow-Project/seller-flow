import { ElectronAPI } from '@electron-toolkit/preload'
import type { AccountApi } from '../shared/account'
import type { AmazonSearchApi } from '../shared/amazon-search'
import type { DataSharingApi } from '../shared/data-sharing'
import type { SettingsApi } from '../shared/settings'
import type { AppUpdateApi } from '../shared/update'
import type { MihomoApi } from '../shared/mihomo'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      account: AccountApi
      amazonSearch: AmazonSearchApi
      dataSharing: DataSharingApi
      mihomo: MihomoApi
      settings: SettingsApi
      updates: AppUpdateApi
    }
    webFrame: {
      setZoomFactor: (factor: number) => void
    }
  }
}
