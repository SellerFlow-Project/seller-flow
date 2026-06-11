import * as cheerio from 'cheerio'
import type { Cheerio, CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'
import type { AmazonSearchConfig } from '../../../shared/amazon-search'
import type { IncomingAmazonSearchKeywordProduct } from '../../types/database'
import { cleanText } from '../../utils/text'
import { absolutizeAmazonUrl } from '../../utils/url'

interface ParsedDeliveryDate {
  days: number
  text: string
}

export interface ParsedAmazonSearchKeywordResult {
  keyword: string
  keywordImage: string
  matchedProductCount: number
  totalProductCount: number
  products: IncomingAmazonSearchKeywordProduct[]
}

type ElementSelection = Cheerio<Element>

const SEARCH_RESULT_SELECTOR = 'div[data-component-type="s-search-result"]'
const DELIVERY_DATE_RE = /(\d{1,2})月(\d{1,2})日/
const ASIN_RE = /^[A-Z0-9]{10}$/
const ASIN_FROM_URL_RE = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/

function parseDeliveryDate(text: string, now = new Date()): ParsedDeliveryDate | null {
  const match = text.match(DELIVERY_DATE_RE)
  if (!match) return null

  const month = Number(match[1])
  const day = Number(match[2])
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let target = new Date(today.getFullYear(), month - 1, day)

  if (
    target.getMonth() !== month - 1 ||
    target.getDate() !== day ||
    Number.isNaN(target.getTime())
  ) {
    return null
  }

  if (target < today) {
    target = new Date(today.getFullYear() + 1, month - 1, day)
  }

  return {
    days: Math.round((target.getTime() - today.getTime()) / 86_400_000),
    text
  }
}

function findAsin($: CheerioAPI, $card: ElementSelection): string {
  const directAsin = cleanText($card.attr('data-asin'))
  if (ASIN_RE.test(directAsin)) return directAsin

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

function findImage($card: ElementSelection): string {
  const $img = $card.find('img.s-image').first()
  const src = cleanText($img.attr('src'))
  return src.startsWith('http') ? src : ''
}

function findTitle($card: ElementSelection): string {
  return (
    cleanText($card.find('div[data-cy="title-recipe"] h2').first().text()) ||
    cleanText($card.find('h2 span').first().text()) ||
    cleanText($card.find('img.s-image').first().attr('alt'))
  )
}

function findPrice($card: ElementSelection): string {
  const offscreen = cleanText($card.find('.a-price .a-offscreen').first().text())
  if (offscreen) return offscreen

  const $price = $card.find('a[aria-describedby="price-link"], .a-price').first()
  const symbol = cleanText($price.find('span.a-price-symbol').first().text())
  const whole = cleanText($price.find('span.a-price-whole').first().text())
    .replace(/[^\d,]/g, '')
    .replace(/,$/, '')

  return whole ? `${symbol || '¥'}${whole}` : ''
}

function findProductUrl($card: ElementSelection, asin: string, baseUrl: string): string {
  const href =
    $card.find(`a[href*="/dp/${asin}"], a[href*="/gp/product/${asin}"]`).first().attr('href') ||
    (asin ? `/dp/${asin}` : '')

  return absolutizeAmazonUrl(href, baseUrl)
}

function findDelivery($: CheerioAPI, $card: ElementSelection): ParsedDeliveryDate | null {
  const candidates = $card
    .find('div.udm-primary-delivery-message span.a-text-bold, [data-cy="delivery-recipe"] span')
    .map((_, element) => cleanText($(element).text()))
    .get()

  for (const candidate of candidates) {
    const parsed = parseDeliveryDate(candidate)
    if (parsed) return parsed
  }

  const cardText = cleanText($card.text())
  return parseDeliveryDate(cardText)
}

export function parseAmazonSearchKeywordHtml(
  html: string,
  keyword: string,
  config: Pick<
    AmazonSearchConfig,
    'minDeliveryInterval' | 'maxDeliveryInterval' | 'matchingProductCount'
  >,
  baseUrl: string
): ParsedAmazonSearchKeywordResult | null {
  const $ = cheerio.load(html)
  const cards = $(SEARCH_RESULT_SELECTOR).toArray()
  const products: IncomingAmazonSearchKeywordProduct[] = []
  const seen = new Set<string>()
  let keywordImage = ''
  let rank = 1

  for (const card of cards) {
    const $card = $(card)
    const delivery = findDelivery($, $card)
    if (!delivery) continue

    if (delivery.days < config.minDeliveryInterval || delivery.days > config.maxDeliveryInterval) {
      continue
    }

    const asin = findAsin($, $card)
    if (!asin || seen.has(asin)) continue

    const image = findImage($card)
    if (!keywordImage && image) keywordImage = image

    products.push({
      asin,
      rank,
      title: findTitle($card),
      price: findPrice($card),
      image,
      productUrl: findProductUrl($card, asin, baseUrl),
      deliveryDays: delivery.days,
      deliveryText: delivery.text
    })
    seen.add(asin)
    rank++
  }

  if (products.length < config.matchingProductCount) {
    return null
  }

  return {
    keyword,
    keywordImage,
    matchedProductCount: products.length,
    totalProductCount: cards.length,
    products
  }
}
