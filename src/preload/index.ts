import { contextBridge, ipcRenderer, webFrame } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
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

const api = {
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
