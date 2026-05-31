import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { getErrorMessage } from '../utils/error'

type IpcHandler<TArgs extends unknown[], TResult> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => TResult | Promise<TResult>

interface IpcHandlerOptions {
  errorField?: 'error' | 'message'
  errorPrefix?: string
}

export function createIpcSuccess(): { success: true }
export function createIpcSuccess<TPayload extends object>(
  payload: TPayload
): { success: true } & TPayload
export function createIpcSuccess<TPayload extends object>(
  payload?: TPayload
): { success: true } | ({ success: true } & TPayload) {
  return {
    success: true,
    ...payload
  }
}

export function handleIpc<TArgs extends unknown[], TResult>(
  channel: string,
  handler: IpcHandler<TArgs, TResult>,
  options: IpcHandlerOptions = {}
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...(args as TArgs))
    } catch (error) {
      const errorField = options.errorField || 'error'
      const message = getErrorMessage(error)
      const errorMessage = options.errorPrefix ? `${options.errorPrefix}: ${message}` : message

      return {
        success: false,
        [errorField]: errorMessage
      }
    }
  })
}
