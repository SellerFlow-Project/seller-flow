import { ElectronAPI } from '@electron-toolkit/preload'
import type { AppUpdateApi } from '../shared/update'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      updates: AppUpdateApi
    }
    webFrame: {
      setZoomFactor: (factor: number) => void
    }
  }
}
