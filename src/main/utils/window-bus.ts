import { BrowserWindow } from 'electron'

export function sendToFirstWindow(channel: string, payload: unknown): void {
  const [firstWindow] = BrowserWindow.getAllWindows()
  firstWindow?.webContents.send(channel, payload)
}

export function sendCrawlerLog(log: string): void {
  sendToFirstWindow('crawler:log-progress', log)
}

export function logAndSendCrawlerLog(log: string): void {
  sendCrawlerLog(log)
  console.log(log)
}
