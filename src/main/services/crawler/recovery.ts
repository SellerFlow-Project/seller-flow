import { CRAWLER_RECOVERY_COOLDOWN_MS } from '../../config/crawler'
import type { CrawlerProgressHandler } from '../../types/crawler'
import { getErrorMessage, isAbortError, throwIfAborted } from '../../utils/error'
import { sleep } from '../../utils/time'
import { AmazonRiskControlError } from './errors'

interface RetryWithCrawlerRecoveryOptions {
  scope: string
  onProgress: CrawlerProgressHandler
  signal?: AbortSignal
  onCooldownStart?: (error: unknown) => void
  onCooldownEnd?: () => void
}

function formatCooldownMinutes(): number {
  return Math.round(CRAWLER_RECOVERY_COOLDOWN_MS / 60_000)
}

function describeRecoverableError(error: unknown): string {
  if (error instanceof AmazonRiskControlError) {
    return '亚马逊风控或请求异常'
  }

  return '网络或服务异常'
}

export async function retryWithCrawlerRecovery<T>(
  action: () => Promise<T>,
  { scope, onProgress, signal, onCooldownStart, onCooldownEnd }: RetryWithCrawlerRecoveryOptions
): Promise<T> {
  while (true) {
    throwIfAborted(signal)

    try {
      return await action()
    } catch (error) {
      if (isAbortError(error)) throw error

      onCooldownStart?.(error)
      onProgress(
        `[恢复] ${scope} 失败，判定为${describeRecoverableError(error)}。${formatCooldownMinutes()} 分钟后将从当前失败位置继续重试。错误信息: ${getErrorMessage(error)}`
      )

      await sleep(CRAWLER_RECOVERY_COOLDOWN_MS, signal)
      throwIfAborted(signal)

      onCooldownEnd?.()
      onProgress(`[恢复] ${scope} 冷却结束，正在重新尝试当前失败位置。`)
    }
  }
}
