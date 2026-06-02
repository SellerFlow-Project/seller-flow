export const CRAWL_TASK_TYPE = {
  BEST_SELLERS: 'best_sellers',
  NEW_RELEASES: 'new_releases'
} as const

export type CrawlTaskType = (typeof CRAWL_TASK_TYPE)[keyof typeof CRAWL_TASK_TYPE]

export const CRAWL_TASK_TYPE_NAMES: Record<CrawlTaskType, string> = {
  [CRAWL_TASK_TYPE.BEST_SELLERS]: '销售排行榜采集',
  [CRAWL_TASK_TYPE.NEW_RELEASES]: '新品排行榜采集'
}

export function isCrawlTaskType(value: unknown): value is CrawlTaskType {
  return Object.values(CRAWL_TASK_TYPE).includes(value as CrawlTaskType)
}
