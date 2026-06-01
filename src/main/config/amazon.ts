import type { AmazonMarketplace, AmazonMarketplaceConfig } from '../types/amazon'
import { HTTP_HEADER } from './http'

export const AMAZON_MARKETPLACE = {
  JP: 'JP',
  US: 'US',
  UK: 'UK',
  DE: 'DE'
} as const satisfies Record<string, AmazonMarketplace>

export const DEFAULT_AMAZON_MARKETPLACE: AmazonMarketplace = AMAZON_MARKETPLACE.JP

export const AMAZON_MAX_DFS_DEPTH = 10
export const AMAZON_ASIN_LENGTH = 10
export const AMAZON_SESSION_COOKIE_NAME = 'session-id'
export const AMAZON_UBID_COOKIE_PREFIX = 'ubid-'
export const AMAZON_CSRF_HEADER = 'anti-csrftoken-a2z'
export const AMAZON_PATH = {
  COOKIE_PROBE: '/s?k=cat',
  ADDRESS_SELECTIONS:
    '/portal-migration/hz/glow/get-rendered-address-selections?deviceType=desktop&pageType=Search&storeContext=NoStoreName&actionSource=desktop-modal',
  ADDRESS_CHANGE: '/portal-migration/hz/glow/address-change?actionSource=glow',
  BEST_SELLERS: '/ranking?type=top-sellers&ref_=nav_cs_bestsellers',
  PRODUCT_DETAIL_PREFIX: '/dp/',
  PRODUCT_DETAIL_SUFFIX: '?psc=1'
} as const
export const AMAZON_BEST_SELLERS_CONTENT_MARKERS = [
  '売れ筋',
  'ランキング',
  'bestsellers',
  'Best Sellers'
] as const
export const AMAZON_RISK_CONTROL_HTTP_STATUS = new Set([403, 429, 503])
export const AMAZON_RISK_CONTROL_HTML_MARKERS = [
  // 'api-services-support@amazon.com',
  'to discuss automated access to amazon data please contact',
  'enter the characters you see below',
  'type the characters you see in this image',
  '画像に表示されている文字を入力してください',
  'id="captchacharacters"'
] as const
export const AMAZON_RISK_CONTROL_RETRY_POLICY = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 3000,
  MAX_DELAY_MS: 15_000
} as const
export const AMAZON_ADDRESS_CHANGE_PAYLOAD = {
  LOCATION_TYPE: 'LOCATION_INPUT',
  DEVICE_TYPE: 'web',
  STORE_CONTEXT: 'hpc',
  PAGE_TYPE: 'Detail',
  ACTION_SOURCE: 'glow'
} as const
export const AMAZON_HTTP_HEADER_VALUE = {
  ACCEPT_HTML:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  ACCEPT_HTML_COOKIE_PROBE:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  ACCEPT_LANGUAGE: 'zh-CN,zh;q=0.9,en;q=0.8'
} as const
export const AMAZON_FALLBACK_COOKIE_VALUE = {
  UBID: '355-5685452-2837352',
  SESSION_ID: '357-7564356-4927846'
} as const

export const AMAZON_MARKETPLACES: Record<AmazonMarketplace, AmazonMarketplaceConfig> = {
  [AMAZON_MARKETPLACE.JP]: {
    code: AMAZON_MARKETPLACE.JP,
    domain: 'www.amazon.co.jp',
    siteName: '日本站 (Amazon.co.jp)',
    zipCode: '169-0074',
    fallbackCountry: '日本',
    ubidCookieName: 'ubid-acbjp',
    baseUrl: 'https://www.amazon.co.jp'
  },
  [AMAZON_MARKETPLACE.US]: {
    code: AMAZON_MARKETPLACE.US,
    domain: 'www.amazon.com',
    siteName: '美国站 (Amazon.com)',
    zipCode: '10001',
    fallbackCountry: '美国',
    ubidCookieName: 'ubid-main',
    baseUrl: 'https://www.amazon.com'
  },
  [AMAZON_MARKETPLACE.UK]: {
    code: AMAZON_MARKETPLACE.UK,
    domain: 'www.amazon.co.uk',
    siteName: '英国站 (Amazon.co.uk)',
    zipCode: 'SW1A 1AA',
    fallbackCountry: '英国',
    ubidCookieName: 'ubid-acbuk',
    baseUrl: 'https://www.amazon.co.uk'
  },
  [AMAZON_MARKETPLACE.DE]: {
    code: AMAZON_MARKETPLACE.DE,
    domain: 'www.amazon.de',
    siteName: '德国站 (Amazon.de)',
    zipCode: '10115',
    fallbackCountry: '德国',
    ubidCookieName: 'ubid-acbde',
    baseUrl: 'https://www.amazon.de'
  }
}

export const DEFAULT_AMAZON_BASE_URL = AMAZON_MARKETPLACES[DEFAULT_AMAZON_MARKETPLACE].baseUrl

export function createAmazonUrl(domain: string, path: string): string {
  return `https://${domain}${path}`
}

export function createAmazonBestSellersUrl(baseUrl: string): string {
  return `${baseUrl}${AMAZON_PATH.BEST_SELLERS}`
}

export function createAmazonProductDetailUrl(baseUrl: string, asin: string): string {
  return `${baseUrl}${AMAZON_PATH.PRODUCT_DETAIL_PREFIX}${asin}${AMAZON_PATH.PRODUCT_DETAIL_SUFFIX}`
}

export function resolveAmazonMarketplace(marketplace?: string): AmazonMarketplaceConfig {
  if (marketplace && marketplace in AMAZON_MARKETPLACES) {
    return AMAZON_MARKETPLACES[marketplace as AmazonMarketplace]
  }

  return AMAZON_MARKETPLACES[DEFAULT_AMAZON_MARKETPLACE]
}

export function createAmazonHtmlHeaders(cookies?: string): Record<string, string> {
  return {
    [HTTP_HEADER.ACCEPT]: AMAZON_HTTP_HEADER_VALUE.ACCEPT_HTML,
    [HTTP_HEADER.ACCEPT_LANGUAGE]: AMAZON_HTTP_HEADER_VALUE.ACCEPT_LANGUAGE,
    ...(cookies ? { [HTTP_HEADER.COOKIE]: cookies } : {})
  }
}
