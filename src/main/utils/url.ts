export function absolutizeAmazonUrl(url: string, baseUrl = 'https://www.amazon.co.jp'): string {
  if (!url) return ''

  try {
    return new URL(url, baseUrl).href
  } catch {
    return url
  }
}

export function getPageFromHref(href = ''): number | null {
  try {
    const url = new URL(href, 'https://www.amazon.co.jp')
    const page = url.searchParams.get('pg')
    return page ? Number(page) : null
  } catch {
    const match = href.match(/[?&]pg=(\d+)/)
    return match ? Number(match[1]) : null
  }
}
