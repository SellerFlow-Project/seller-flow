import { sleep } from '../../utils/time'
import { getCrawlingSettings } from '../settings.service'

const MILLISECONDS_PER_SECOND = 1000

export function createCrawlerRequestDelayMilliseconds(
  minDelaySeconds: number,
  maxDelaySeconds: number,
  randomValue = Math.random()
): number {
  const minimum = Math.max(0, Math.min(minDelaySeconds, maxDelaySeconds))
  const maximum = Math.max(minimum, maxDelaySeconds)
  return Math.round((minimum + (maximum - minimum) * randomValue) * MILLISECONDS_PER_SECOND)
}

export async function sleepForCrawlerRequestDelay(signal?: AbortSignal): Promise<void> {
  const { minDelay, maxDelay } = getCrawlingSettings()
  const delayMilliseconds = createCrawlerRequestDelayMilliseconds(minDelay, maxDelay)

  if (delayMilliseconds > 0) {
    await sleep(delayMilliseconds, signal)
  }
}
