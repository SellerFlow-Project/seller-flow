export type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface AppUpdateInfo {
  version: string
  releaseName?: string
  releaseNotes?: string
  releaseDate?: string
}

export interface AppUpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export interface AppUpdateState {
  currentVersion: string
  isSupported: boolean
  revision: number
  status: AppUpdateStatus
  updateInfo?: AppUpdateInfo
  progress?: AppUpdateProgress
  error?: string
}

export interface AppUpdateActionResult {
  success: boolean
  message?: string
}

export interface AppUpdateApi {
  getState: () => Promise<AppUpdateState>
  checkForUpdates: () => Promise<AppUpdateActionResult>
  downloadUpdate: () => Promise<AppUpdateActionResult>
  quitAndInstall: () => Promise<AppUpdateActionResult>
  onStateChange: (callback: (state: AppUpdateState) => void) => () => void
}
