import { DEFAULT_AMAZON_BASE_URL } from '../config/amazon'

export function absolutizeAmazonUrl(url: string, baseUrl = DEFAULT_AMAZON_BASE_URL): string {
  if (!url) return ''

  try {
    return new URL(url, baseUrl).href
  } catch {
    return url
  }
}

export function getPageFromHref(href = ''): number | null {
  try {
    const url = new URL(href, DEFAULT_AMAZON_BASE_URL)
    const page = url.searchParams.get('pg')
    return page ? Number(page) : null
  } catch {
    const match = href.match(/[?&]pg=(\d+)/)
    return match ? Number(match[1]) : null
  }
}
