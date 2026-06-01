import { contextBridge, ipcRenderer, webFrame } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  isApplicationSettings,
  isSellerFlowSettings,
  type ApplicationSettings,
  type SellerFlowSettings,
  type SettingsApi
} from '../shared/settings'
import type { AppUpdateApi, AppUpdateState } from '../shared/update'

// Custom APIs for renderer
const updates: AppUpdateApi = {
  getState: () => ipcRenderer.invoke('update:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  quitAndInstall: () => ipcRenderer.invoke('update:quit-and-install'),
  onStateChange: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppUpdateState): void => {
      callback(state)
    }

    ipcRenderer.on('update:state', listener)
    return () => ipcRenderer.removeListener('update:state', listener)
  }
}

function getIpcErrorMessage(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('success' in value)) {
    return undefined
  }

  const response = value as { success?: boolean; error?: unknown; message?: unknown }
  if (response.success !== false) {
    return undefined
  }

  return typeof response.error === 'string'
    ? response.error
    : typeof response.message === 'string'
      ? response.message
      : '主进程未能完成配置操作。'
}

async function invokeSettings<T>(
  channel: string,
  args: unknown[],
  validator: (value: unknown) => value is T
): Promise<T> {
  const response: unknown = await ipcRenderer.invoke(channel, ...args)
  const errorMessage = getIpcErrorMessage(response)

  if (errorMessage) {
    throw new Error(errorMessage)
  }

  if (!validator(response)) {
    throw new Error('主进程返回了不完整的配置数据。')
  }

  return response
}

const settings: SettingsApi = {
  get: (): Promise<SellerFlowSettings> => invokeSettings('settings:get', [], isSellerFlowSettings),
  save: (nextSettings): Promise<SellerFlowSettings> =>
    invokeSettings('settings:save', [nextSettings], isSellerFlowSettings),
  updateApplication: (nextSettings): Promise<ApplicationSettings> =>
    invokeSettings('settings:update-application', [nextSettings], isApplicationSettings)
}

const api = {
  settings,
  updates
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('webFrame', {
      setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor)
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore - define in dts
  window.webFrame = {
    setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor)
  }
}
