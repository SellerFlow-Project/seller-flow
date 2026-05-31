import type { CRAWLER_RUN_STATE, CRAWL_STRATEGY, CRAWL_TASK_TYPE } from '../config/crawler'
import type { AmazonMarketplace, AmazonCategory } from './amazon'

export type CrawlStrategy = (typeof CRAWL_STRATEGY)[keyof typeof CRAWL_STRATEGY]
export type CrawlTaskType = (typeof CRAWL_TASK_TYPE)[keyof typeof CRAWL_TASK_TYPE]
export type CrawlerRunState = (typeof CRAWLER_RUN_STATE)[keyof typeof CRAWLER_RUN_STATE]

export interface CrawlTaskConfig {
  taskType: CrawlTaskType
  marketplace: AmazonMarketplace
  maxPages?: number
  crawlStrategy?: CrawlStrategy
  selectedCategories?: AmazonCategory[]
}

export interface DfsPathNode {
  name: string
  depth: number
}

export interface DfsState {
  firstLevelCats: string[]
  completedPrimaries: string[]
  activePath: DfsPathNode[]
  isCrawling: boolean
  runState: CrawlerRunState
}

export interface CrawlerStatus {
  isRunning: boolean
  isStopping: boolean
  runState: CrawlerRunState
  taskId: number | null
  config: CrawlTaskConfig | null
}

export interface CrawlerStartResult {
  taskId: number
  runState: typeof CRAWLER_RUN_STATE.RUNNING
}

export interface CrawlerStopResult {
  accepted: boolean
  taskId: number | null
  runState: CrawlerRunState
  databaseStatusUpdated: boolean
}

export type CrawlerProgressHandler = (log: string, data?: unknown) => void
