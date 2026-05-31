import type {
  CRAWL_TASK_STATUS,
  PRODUCT_SORT_ORDER,
  SELLERSPRITE_ACCOUNT_STATUS,
  SPRITE_ACCOUNT_CLEAR_SCOPE,
  SQLITE_BOOLEAN
} from '../config/database'
import type { Currency } from '../config/price'

export type CrawlTaskStatus = (typeof CRAWL_TASK_STATUS)[keyof typeof CRAWL_TASK_STATUS]
export type SellerSpriteAccountStatus =
  (typeof SELLERSPRITE_ACCOUNT_STATUS)[keyof typeof SELLERSPRITE_ACCOUNT_STATUS]
export type ProductSortOrder = (typeof PRODUCT_SORT_ORDER)[keyof typeof PRODUCT_SORT_ORDER]
export type SpriteAccountClearScope =
  (typeof SPRITE_ACCOUNT_CLEAR_SCOPE)[keyof typeof SPRITE_ACCOUNT_CLEAR_SCOPE]
export type SqliteBoolean = (typeof SQLITE_BOOLEAN)[keyof typeof SQLITE_BOOLEAN]

export interface ParsedPrice {
  currency: Currency
  amount: number
}

export interface ProductQueryFilter {
  taskId?: number
  query?: string
  category?: string
  sellerType?: string
  minPrice?: number
  maxPrice?: number
  limit?: number
  offset?: number
  sortBy?: string
  sortOrder?: ProductSortOrder
  hasSellerSpriteData?: boolean
}

export interface ProductBsrRankInput {
  rank: number
  main: boolean
  id: string
  label: string
  text: string
  href: string
}

export interface ProductSellerSpriteData {
  sellerType?: string
  units?: number
  available?: number
  bsrList: ProductBsrRankInput[]
}

export interface IncomingCrawledProduct {
  asin?: string
  rank?: number | null
  title?: string
  price?: string
  image?: string
  productUrl?: string
  sellerSprite?: ProductSellerSpriteData
}

export interface CrawlTaskRow {
  id: number
  task_name: string
  task_type: string
  marketplace: string
  status: CrawlTaskStatus
  created_at: string
  completed_at?: string | null
  skuCount?: number
}

export interface CrawledProductRow {
  id: number
  task_id: number
  asin: string
  rank: number
  title: string
  currency: string
  price_amount: number
  original_price?: string | null
  image_url: string
  product_url: string
  category_name: string
  seller_type?: string | null
  sellersprite_units?: number | null
  sellersprite_available?: number | null
  has_sellersprite_data: SqliteBoolean
  crawled_at: string
}

export interface ProductBsrRankRow {
  id: number
  product_id: number
  task_id: number
  asin: string
  rank: number
  is_main: SqliteBoolean
  bsr_id: string
  label: string
  text: string
  href: string
  created_at: string
}

export interface DatabaseStatistics {
  totalTasks: number
  totalSKUs: number
  avgPrice: number
  dbSizeBytes?: number
  dbSizeMB?: string
}

export interface SellerSpriteAccountRow {
  id: number
  username: string
  password: string
  status: SellerSpriteAccountStatus
  created_at: string
  updated_at: string
}
