import { ElectronAPI } from '@electron-toolkit/preload'
import type { SettingsApi } from '../shared/settings'
import type { AppUpdateApi } from '../shared/update'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      settings: SettingsApi
      updates: AppUpdateApi
    }
    webFrame: {
      setZoomFactor: (factor: number) => void
    }
  }
}
