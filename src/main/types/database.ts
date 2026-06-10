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

export interface SearchKeywordQueryFilter {
  taskId?: number
  limit?: number
  offset?: number
  sortBy?: string
  sortOrder?: ProductSortOrder
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

export interface IncomingAmazonSearchKeywordProduct extends IncomingCrawledProduct {
  deliveryDays?: number | null
  deliveryText?: string
}

export interface IncomingAmazonSearchKeywordResult {
  keyword: string
  keywordImage?: string
  filterCriteria: string
  matchedProductCount: number
  totalProductCount: number
  rankingRange: string
  fluctuationRange: string
  amz123Raw?: string
  products: IncomingAmazonSearchKeywordProduct[]
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
  delivery_days?: string | null
  has_delivery_detail: SqliteBoolean
  is_read: SqliteBoolean
  crawled_at: string
}

export interface PendingDeliveryDetailProduct {
  id: number
  task_id: number
  asin: string
  title: string
}

export interface ProductDeliveryDetailUpdate {
  productId: number
  deliveryDays: string | null
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

export interface AmazonSearchKeywordRow {
  id: number
  task_id: number
  keyword: string
  keyword_image_url?: string | null
  first_product_image_url?: string | null
  matched_product_count: number
  linked_product_count: number
  is_read: SqliteBoolean
  created_at: string
  marketplace: string
}

export interface AmazonSearchKeywordProductRow extends CrawledProductRow {
  keyword_id: number
  keyword: string
  delivery_text?: string | null
  keyword_delivery_days?: number | null
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
