import { app } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import type { AppUpdateActionResult, AppUpdateInfo, AppUpdateState } from '../../shared/update'
import { getErrorMessage } from '../utils/error'
import { sendToFirstWindow } from '../utils/window-bus'
import { WINDOW_CHANNEL } from '../config/ipc'

const UPDATE_CHECK_DELAY_MS = 5_000

let initialized = false
let state: AppUpdateState = {
  currentVersion: app.getVersion(),
  isSupported: false,
  revision: 0,
  status: 'idle'
}

function normalizeReleaseNotes(releaseNotes: UpdateInfo['releaseNotes']): string | undefined {
  if (typeof releaseNotes === 'string') {
    return releaseNotes
  }

  if (Array.isArray(releaseNotes)) {
    const notes = releaseNotes
      .map((releaseNote) => releaseNote.note)
      .filter((note): note is string => Boolean(note))
      .join('\n\n')

    return notes || undefined
  }

  return undefined
}

function createUpdateInfo(updateInfo: UpdateInfo): AppUpdateInfo {
  return {
    version: updateInfo.version,
    releaseName: updateInfo.releaseName || undefined,
    releaseNotes: normalizeReleaseNotes(updateInfo.releaseNotes),
    releaseDate: updateInfo.releaseDate
  }
}

function setState(nextState: Partial<AppUpdateState>): void {
  state = {
    ...state,
    ...nextState,
    revision: state.revision + 1
  }

  sendToFirstWindow(WINDOW_CHANNEL.UPDATE_STATE, state)
}

function createFailure(message: string): AppUpdateActionResult {
  return {
    success: false,
    message
  }
}

function ensureSupported(): AppUpdateActionResult | undefined {
  if (state.isSupported) {
    return undefined
  }

  return createFailure(
    app.isPackaged
      ? '当前平台暂未启用应用内更新。'
      : '开发环境不会连接线上更新服务，请安装正式版后测试。'
  )
}

export function getUpdateState(): AppUpdateState {
  return state
}

export async function checkForUpdates(): Promise<AppUpdateActionResult> {
  const unsupportedResult = ensureSupported()
  if (unsupportedResult) {
    return unsupportedResult
  }

  if (state.status === 'downloaded') {
    return createFailure('新版本已经下载完成，请重启应用完成安装。')
  }

  if (state.status === 'checking' || state.status === 'downloading') {
    return createFailure('更新任务正在进行中，请稍候。')
  }

  setState({
    status: 'checking',
    error: undefined
  })

  try {
    await autoUpdater.checkForUpdates()
    return { success: true }
  } catch (error) {
    const message = getErrorMessage(error)
    setState({
      status: 'error',
      error: message
    })
    return createFailure(message)
  }
}

export async function downloadUpdate(): Promise<AppUpdateActionResult> {
  const unsupportedResult = ensureSupported()
  if (unsupportedResult) {
    return unsupportedResult
  }

  if (state.status !== 'available') {
    return createFailure('当前没有可下载的新版本。')
  }

  setState({
    status: 'downloading',
    progress: {
      percent: 0,
      bytesPerSecond: 0,
      transferred: 0,
      total: 0
    },
    error: undefined
  })

  try {
    await autoUpdater.downloadUpdate()
    return { success: true }
  } catch (error) {
    const message = getErrorMessage(error)
    setState({
      status: 'error',
      error: message
    })
    return createFailure(message)
  }
}

export async function quitAndInstallUpdate(): Promise<AppUpdateActionResult> {
  const unsupportedResult = ensureSupported()
  if (unsupportedResult) {
    return unsupportedResult
  }

  if (state.status !== 'downloaded') {
    return createFailure('新版本尚未下载完成。')
  }

  setImmediate(() => autoUpdater.quitAndInstall())
  return { success: true }
}

export function initializeAutoUpdater(): void {
  if (initialized) {
    return
  }

  initialized = true
  state = {
    currentVersion: app.getVersion(),
    isSupported: app.isPackaged && process.platform === 'win32',
    revision: 0,
    status: 'idle'
  }

  if (!state.isSupported) {
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    setState({
      status: 'checking',
      error: undefined
    })
  })

  autoUpdater.on('update-available', (updateInfo) => {
    setState({
      status: 'available',
      updateInfo: createUpdateInfo(updateInfo),
      progress: undefined,
      error: undefined
    })
  })

  autoUpdater.on('update-not-available', (updateInfo) => {
    setState({
      status: 'not-available',
      updateInfo: createUpdateInfo(updateInfo),
      progress: undefined,
      error: undefined
    })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    setState({
      status: 'downloading',
      progress: {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      },
      error: undefined
    })
  })

  autoUpdater.on('update-downloaded', (updateInfo) => {
    setState({
      status: 'downloaded',
      updateInfo: createUpdateInfo(updateInfo),
      progress: {
        ...state.progress,
        percent: 100,
        bytesPerSecond: 0,
        transferred: state.progress?.total || 0,
        total: state.progress?.total || 0
      },
      error: undefined
    })
  })

  autoUpdater.on('error', (error) => {
    setState({
      status: 'error',
      error: getErrorMessage(error)
    })
  })

  setTimeout(() => {
    void checkForUpdates()
  }, UPDATE_CHECK_DELAY_MS)
}
