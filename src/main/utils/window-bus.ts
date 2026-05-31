import { BrowserWindow } from 'electron'
import { WINDOW_CHANNEL } from '../config/ipc'

export function sendToFirstWindow(channel: string, payload: unknown): void {
  const [firstWindow] = BrowserWindow.getAllWindows()
  firstWindow?.webContents.send(channel, payload)
}

export function sendCrawlerLog(log: string): void {
  sendToFirstWindow(WINDOW_CHANNEL.CRAWLER_LOG_PROGRESS, log)
}

export function logAndSendCrawlerLog(log: string): void {
  sendCrawlerLog(log)
  console.log(log)
}
