import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { APP_NAME, APP_USER_MODEL_ID } from './config/app'
import { IPC_CHANNEL } from './config/ipc'
import { registerAllIPC } from './ipc'
import { createMainWindow } from './window/main-window'

function registerAppLifecycle(): void {
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

app.whenReady().then(() => {
  app.name = APP_NAME
  electronApp.setAppUserModelId(APP_USER_MODEL_ID)

  registerAppLifecycle()
  registerAllIPC()

  // IPC smoke-test channel kept for compatibility with electron-vite template tooling.
  ipcMain.on(IPC_CHANNEL.PING, () => console.log('pong'))

  createMainWindow()
})
