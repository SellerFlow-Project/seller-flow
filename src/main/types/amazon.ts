export type AmazonMarketplace = 'JP' | 'US' | 'UK' | 'DE'

export interface AmazonMarketplaceConfig {
  code: AmazonMarketplace
  domain: string
  siteName: string
  zipCode: string
  fallbackCountry: string
  ubidCookieName: string
  baseUrl: string
}

export interface AmazonCategory {
  name: string
  href: string
}

export interface AmazonPaginationPage {
  page: number
  url: string
  isCurrent: boolean
  isDisabled: boolean
}

export interface AmazonPagination {
  hasPagination: boolean
  currentPage: number | null
  hasNextPage: boolean
  nextPageUrl: string
  pages: AmazonPaginationPage[]
}

export interface AmazonCookieResult {
  success: boolean
  cookies: string
  address?: string
  error?: string
}

export interface AmazonBestSellersPageResult {
  success: boolean
  htmlLength: number
  htmlSnippet: string
  isJapanese: boolean
  categories: AmazonCategory[]
  error?: string
}

export interface AmazonParsedProduct {
  rank: number | null
  asin: string
  title: string
  price: string
  image: string
  productUrl: string
}
