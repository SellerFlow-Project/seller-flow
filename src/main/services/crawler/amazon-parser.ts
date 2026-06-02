import * as cheerio from 'cheerio'
import type { Cheerio, CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'
import type {
  AmazonCategory,
  AmazonPagination,
  AmazonPaginationPage,
  AmazonParsedProduct
} from '../../types/amazon'
import { AMAZON_ASIN_LENGTH, DEFAULT_AMAZON_BASE_URL } from '../../config/amazon'
import { CRAWLER_INITIAL_PAGE } from '../../config/crawler'
import { cleanText } from '../../utils/text'
import { absolutizeAmazonUrl, getPageFromHref } from '../../utils/url'

const ASIN_RE = new RegExp(`^[A-Z0-9]{${AMAZON_ASIN_LENGTH}}$`)
const ASIN_FROM_URL_RE = new RegExp(
  `/(?:dp|gp/product)/([A-Z0-9]{${AMAZON_ASIN_LENGTH}})(?:[/?]|$)`
)
const PRICE_RE = /(?:JP¥|￥|¥)\s?[\d,]+(?:\.\d+)?/

type ElementSelection = Cheerio<Element>

function pickBestImage($img: ElementSelection): string {
  const dynamicImage = $img.attr('data-a-dynamic-image')

  if (dynamicImage) {
    try {
      const jsonText = dynamicImage.replace(/&quot;/g, '"')
      const imageMap = JSON.parse(jsonText) as Record<string, [number, number]>
      const best = Object.entries(imageMap).sort(([, aSize], [, bSize]) => {
        const [aWidth = 0, aHeight = 0] = aSize || []
        const [bWidth = 0, bHeight = 0] = bSize || []
        return bWidth * bHeight - aWidth * aHeight
      })[0]

      if (best?.[0]) return best[0]
    } catch {
      // data-a-dynamic-image 有时会被转义或截断，失败就回退 src
    }
  }

  return $img.attr('src') || ''
}

function findAsin($: CheerioAPI, $card: ElementSelection): string {
  const directAsin = cleanText($card.find('[data-asin]').first().attr('data-asin'))

  if (ASIN_RE.test(directAsin)) {
    return directAsin
  }

  const hrefs = $card
    .find('a[href*="/dp/"], a[href*="/gp/product/"]')
    .map((_, element) => $(element).attr('href') || '')
    .get()

  for (const href of hrefs) {
    const match = href.match(ASIN_FROM_URL_RE)
    if (match?.[1]) return match[1]
  }

  return ''
}

function findProductUrl($card: ElementSelection, asin: string): string {
  const href = $card
    .find(`a[href*="/dp/${asin}"], a[href*="/gp/product/${asin}"]`)
    .first()
    .attr('href')

  return absolutizeAmazonUrl(href || (asin ? `/dp/${asin}` : ''))
}

function findTitle($card: ElementSelection, $img: ElementSelection): string {
  const title = cleanText($card.find('a.a-link-normal.aok-block[role="link"]').first().text())
  return title || cleanText($img.attr('alt'))
}

function findPrice($: CheerioAPI, $card: ElementSelection): string {
  const candidates = $card
    .find('span[class*="p13n-sc-price"], .a-price .a-offscreen, span.a-color-price')
    .map((_, element) => cleanText($(element).text()))
    .get()

  for (const text of candidates) {
    const match = text.match(PRICE_RE)
    if (match) return match[0]
  }

  return ''
}

export function parseAmazonPagination(
  $: CheerioAPI,
  currentUrl = DEFAULT_AMAZON_BASE_URL
): AmazonPagination {
  const $pagination = $('nav[aria-label="pagination"] ul.a-pagination').first()

  if (!$pagination.length) {
    return {
      hasPagination: false,
      currentPage: null,
      hasNextPage: false,
      nextPageUrl: '',
      pages: []
    }
  }

  const pages: AmazonPaginationPage[] = []

  $pagination.find('li').each((_, li) => {
    const $li = $(li)
    const $a = $li.find('a[href]').first()

    const text = cleanText($li.text())
    const href = $a.attr('href') || ''
    const ariaLabel = $li.attr('aria-label') || ''

    let page: number | null = null

    const ariaPageMatch = ariaLabel.match(/Page\s+(\d+)/i)
    if (ariaPageMatch) {
      page = Number(ariaPageMatch[1])
    }

    if (!page && /^\d+$/.test(text)) {
      page = Number(text)
    }

    if (!page && href) {
      page = getPageFromHref(href)
    }

    if (page) {
      pages.push({
        page,
        url: absolutizeAmazonUrl(href, currentUrl),
        isCurrent: $li.hasClass('a-selected') || $a.attr('aria-current') === 'page',
        isDisabled: $li.hasClass('a-disabled')
      })
    }
  })

  const currentPage =
    pages.find((item) => item.isCurrent)?.page ||
    getPageFromHref(currentUrl) ||
    CRAWLER_INITIAL_PAGE
  const $nextLi = $pagination.find('li.a-last').first()
  const nextHref = $nextLi.find('a[href]').first().attr('href') || ''
  const hasNextPage =
    Boolean($nextLi.length) && !$nextLi.hasClass('a-disabled') && Boolean(nextHref)

  return {
    hasPagination: true,
    currentPage,
    hasNextPage,
    nextPageUrl: hasNextPage ? absolutizeAmazonUrl(nextHref, currentUrl) : '',
    pages
  }
}

export function parseAmazonRankingHtml(html: string): AmazonParsedProduct[] {
  const $ = cheerio.load(html)

  let cards = $('div[id^="p13n-asin-index-"].p13n-grid-content').toArray()

  if (!cards.length) {
    cards = $('[data-asin]')
      .filter((_, element) => ASIN_RE.test(cleanText($(element).attr('data-asin'))))
      .toArray()
  }

  const results: AmazonParsedProduct[] = []
  const seen = new Set<string>()

  for (const cardEl of cards) {
    const $card = $(cardEl)
    const asin = findAsin($, $card)

    if (!asin || seen.has(asin)) continue

    const $img = $card
      .find('img.p13n-product-image, img.p13n-sc-dynamic-image, img[data-a-dynamic-image]')
      .first()

    results.push({
      rank: Number(cleanText($card.find('.zg-bdg-text').first().text()).replace('#', '')) || null,
      asin,
      title: findTitle($card, $img),
      price: findPrice($, $card),
      image: pickBestImage($img),
      productUrl: findProductUrl($card, asin)
    })

    seen.add(asin)
  }

  return results
}

export function parseAmazonRankingCategories(
  html: string,
  baseUrl = DEFAULT_AMAZON_BASE_URL
): AmazonCategory[] {
  const $ = cheerio.load(html)
  const categories: AmazonCategory[] = []

  $(
    'ul.a-unordered-list.a-nostyle.a-vertical._p13n-zg-nav-tree-all_style_zg-browse-group__88fbz li a'
  ).each((_, anchor) => {
    const $anchor = $(anchor)
    const href = $anchor.attr('href') || ''
    const name = cleanText($anchor.text())

    if (name && href) {
      categories.push({
        name,
        href: absolutizeAmazonUrl(href, baseUrl)
      })
    }
  })

  return categories
}

export function parseAmazonRankingChildCategories(
  html: string,
  currentUrl = DEFAULT_AMAZON_BASE_URL
): AmazonCategory[] {
  const $ = cheerio.load(html)
  const categories: AmazonCategory[] = []
  const seen = new Set<string>()
  const $root = $('#zg-left-col').length ? $('#zg-left-col') : $('body')
  const $current = $root.find('[aria-current="page"], .zg-selected, [class*="zg-selected"]').first()

  if (!$current.length) return []

  const $currentLi = $current.closest('li')
  if (!$currentLi.length) return []

  let $childUl = $currentLi.children('ul').first()

  if (!$childUl.length) {
    $childUl = $currentLi.children('.a-list-item').children('ul').first()
  }

  if (!$childUl.length) {
    const $nextLi = $currentLi.next('li')
    $childUl = $nextLi.children('.a-list-item').children('ul').first()
  }

  if (!$childUl.length) return []

  $childUl.children('li').each((_, li) => {
    const $li = $(li)
    const $anchor = $li.children('.a-list-item').find('a[href]').first()
    const href = $anchor.attr('href') || ''
    const name = cleanText($anchor.text())

    if (!name || !href) return

    const absHref = absolutizeAmazonUrl(href, currentUrl)
    if (seen.has(absHref)) return

    seen.add(absHref)
    categories.push({
      name,
      href: absHref
    })
  })

  return categories
}

export {
  cleanText,
  absolutizeAmazonUrl,
  getPageFromHref,
  pickBestImage,
  findAsin,
  findProductUrl,
  findTitle,
  findPrice
}

export const parseAmazonBestSellerHtml = parseAmazonRankingHtml
export const parseBestsellerCategories = parseAmazonRankingCategories
export const parseBestsellerChildCategories = parseAmazonRankingChildCategories
