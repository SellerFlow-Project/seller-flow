const ABORT_ERROR_NAME = 'AbortError'

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createAbortError(message = '操作已取消'): Error {
  const error = new Error(message)
  error.name = ABORT_ERROR_NAME
  return error
}

export function isAbortError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === ABORT_ERROR_NAME
  )
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

export function getErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined
}
