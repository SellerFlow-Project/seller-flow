export type CrawlTaskStatus = 'running' | 'completed' | 'failed' | 'cancelled'
export type SellerSpriteAccountStatus = 'normal' | 'invalid'

export interface ParsedPrice {
  currency: string
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
  sortOrder?: 'ASC' | 'DESC'
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
  has_sellersprite_data: 0 | 1
  crawled_at: string
}

export interface ProductBsrRankRow {
  id: number
  product_id: number
  task_id: number
  asin: string
  rank: number
  is_main: 0 | 1
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
}

export interface SellerSpriteAccountRow {
  id: number
  username: string
  password: string
  status: SellerSpriteAccountStatus
  created_at: string
  updated_at: string
}
