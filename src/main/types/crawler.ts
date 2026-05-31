import type { AmazonMarketplace, AmazonCategory } from './amazon'

export type CrawlStrategy = 'strategy1' | 'strategy2'

export interface CrawlTaskConfig {
  taskType: string
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
}

export interface CrawlerStatus {
  isRunning: boolean
  config: CrawlTaskConfig | null
}

export type CrawlerProgressHandler = (log: string, data?: unknown) => void
