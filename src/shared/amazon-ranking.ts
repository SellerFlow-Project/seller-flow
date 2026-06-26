export interface AmazonRankingConfig {
  deliveryConcurrency: number
}

export const DEFAULT_AMAZON_RANKING_CONFIG: AmazonRankingConfig = {
  deliveryConcurrency: 5
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeNumber(value: unknown, fallback: number, min = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.floor(value))
    : fallback
}

export function normalizeAmazonRankingConfig(value: unknown): AmazonRankingConfig {
  const raw = isRecord(value) ? value : {}

  return {
    deliveryConcurrency: normalizeNumber(
      raw.deliveryConcurrency,
      DEFAULT_AMAZON_RANKING_CONFIG.deliveryConcurrency,
      1
    )
  }
}

export function isAmazonRankingConfig(value: unknown): value is AmazonRankingConfig {
  return isRecord(value) && typeof value.deliveryConcurrency === 'number'
}
