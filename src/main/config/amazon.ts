import type { AmazonMarketplace, AmazonMarketplaceConfig } from '../types/amazon'

export const DEFAULT_AMAZON_MARKETPLACE: AmazonMarketplace = 'JP'

export const AMAZON_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export const AMAZON_CRAWL_DELAY_MS = 1500
export const AMAZON_MAX_DFS_DEPTH = 10

export const AMAZON_MARKETPLACES: Record<AmazonMarketplace, AmazonMarketplaceConfig> = {
  JP: {
    code: 'JP',
    domain: 'www.amazon.co.jp',
    siteName: '日本站 (Amazon.co.jp)',
    zipCode: '169-0074',
    fallbackCountry: '日本',
    ubidCookieName: 'ubid-acbjp',
    baseUrl: 'https://www.amazon.co.jp'
  },
  US: {
    code: 'US',
    domain: 'www.amazon.com',
    siteName: '美国站 (Amazon.com)',
    zipCode: '10001',
    fallbackCountry: '美国',
    ubidCookieName: 'ubid-main',
    baseUrl: 'https://www.amazon.com'
  },
  UK: {
    code: 'UK',
    domain: 'www.amazon.co.uk',
    siteName: '英国站 (Amazon.co.uk)',
    zipCode: 'SW1A 1AA',
    fallbackCountry: '英国',
    ubidCookieName: 'ubid-acbuk',
    baseUrl: 'https://www.amazon.co.uk'
  },
  DE: {
    code: 'DE',
    domain: 'www.amazon.de',
    siteName: '德国站 (Amazon.de)',
    zipCode: '10115',
    fallbackCountry: '德国',
    ubidCookieName: 'ubid-acbde',
    baseUrl: 'https://www.amazon.de'
  }
}

export function resolveAmazonMarketplace(marketplace?: string): AmazonMarketplaceConfig {
  if (marketplace && marketplace in AMAZON_MARKETPLACES) {
    return AMAZON_MARKETPLACES[marketplace as AmazonMarketplace]
  }

  return AMAZON_MARKETPLACES[DEFAULT_AMAZON_MARKETPLACE]
}

export function createAmazonHtmlHeaders(cookies?: string): Record<string, string> {
  return {
    'User-Agent': AMAZON_USER_AGENT,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    ...(cookies ? { Cookie: cookies } : {})
  }
}
