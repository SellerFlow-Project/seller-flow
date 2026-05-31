import { createAbortError, throwIfAborted } from './error'

const SHORT_YEAR_START_INDEX = 2
const DATE_PART_LENGTH = 2
const MILLISECOND_PART_LENGTH = 3
const DATE_PART_PAD_CHARACTER = '0'
const MONTH_INDEX_OFFSET = 1

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, ms)
    const handleAbort = (): void => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', handleAbort)
      reject(createAbortError())
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

export function createCompactTimestamp(date = new Date()): string {
  const year = String(date.getFullYear()).substring(SHORT_YEAR_START_INDEX)
  const month = String(date.getMonth() + MONTH_INDEX_OFFSET).padStart(
    DATE_PART_LENGTH,
    DATE_PART_PAD_CHARACTER
  )
  const day = String(date.getDate()).padStart(DATE_PART_LENGTH, DATE_PART_PAD_CHARACTER)
  const hour = String(date.getHours()).padStart(DATE_PART_LENGTH, DATE_PART_PAD_CHARACTER)
  const minute = String(date.getMinutes()).padStart(DATE_PART_LENGTH, DATE_PART_PAD_CHARACTER)
  const second = String(date.getSeconds()).padStart(DATE_PART_LENGTH, DATE_PART_PAD_CHARACTER)
  const milliseconds = String(date.getMilliseconds()).padStart(
    MILLISECOND_PART_LENGTH,
    DATE_PART_PAD_CHARACTER
  )

  return `${year}-${month}${day}-${hour}${minute}${second}-${milliseconds}`
}
