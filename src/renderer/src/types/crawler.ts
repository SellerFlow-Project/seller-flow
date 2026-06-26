/**
 * 爬虫与数据采集核心模块类型定义
 * 用于解耦渲染进程 UI、业务逻辑以及后续的主进程 SQLite 数据存储
 */

import {
  CRAWL_TASK_TYPE,
  CRAWL_TASK_TYPE_NAMES,
  type CrawlTaskType as SharedCrawlTaskType
} from '../../../shared/crawler'

export const CrawlTaskType = CRAWL_TASK_TYPE
export type CrawlTaskType = SharedCrawlTaskType
export const CrawlTaskTypeNames = CRAWL_TASK_TYPE_NAMES

/**
 * 亚马逊站点地区枚举
 */
export enum AmazonMarketplace {
  JP = 'JP', // 日本站 (Amazon.co.jp)
  US = 'US', // 美国站 (Amazon.com)
  UK = 'UK', // 英国站 (Amazon.co.uk)
  DE = 'DE' // 德国站 (Amazon.de)
}

/**
 * 亚马逊站点详细参数配置接口
 */
export interface MarketplaceConfig {
  name: string
  domain: string
  baseUrl: string
  locale: string
  currency: string
}

/**
 * 各站点元数据映射表
 */
export const MarketplaceConfigs: Record<AmazonMarketplace, MarketplaceConfig> = {
  [AmazonMarketplace.JP]: {
    name: '日本站 (Amazon.co.jp)',
    domain: 'amazon.co.jp',
    baseUrl: 'https://www.amazon.co.jp',
    locale: 'ja_JP',
    currency: 'JPY'
  },
  [AmazonMarketplace.US]: {
    name: '美国站 (Amazon.com)',
    domain: 'amazon.com',
    baseUrl: 'https://www.amazon.com',
    locale: 'en_US',
    currency: 'USD'
  },
  [AmazonMarketplace.UK]: {
    name: '英国站 (Amazon.co.uk)',
    domain: 'amazon.co.uk',
    baseUrl: 'https://www.amazon.co.uk',
    locale: 'en_GB',
    currency: 'GBP'
  },
  [AmazonMarketplace.DE]: {
    name: '德国站 (Amazon.de)',
    domain: 'amazon.de',
    baseUrl: 'https://www.amazon.de',
    locale: 'de_DE',
    currency: 'EUR'
  }
}

export interface AmazonCategory {
  name: string
  href: string
}

/**
 * 爬虫任务配置参数接口
 */
export interface CrawlTaskConfig {
  taskType: CrawlTaskType
  marketplace: AmazonMarketplace
  maxPages?: number
  crawlStrategy?: 'strategy1' | 'strategy2'
  deliveryConcurrency?: number
  selectedCategories?: AmazonCategory[]
}

/**
 * 采集到的商品数据模型定义 (后续与 SQLite 表结构一一对应)
 */
export interface CrawledProduct {
  id: string
  asin: string
  title: string
  price: number
  currency: string
  rating: number
  category: string
  stock: number
  url: string
  crawledAt: string
}
