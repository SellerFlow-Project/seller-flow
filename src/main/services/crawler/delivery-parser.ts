import * as cheerio from 'cheerio'
import moment from 'moment'
import 'moment/locale/de'
import 'moment/locale/es'
import 'moment/locale/fr'
import 'moment/locale/it'
import 'moment/locale/ja'
import 'moment/locale/pt'
import type { AmazonMarketplace } from '../../types/amazon'

interface DeliveryStationConfig {
  code: string
  timezoneOffset: number
  locale: string
}

export interface AmazonDeliveryInfo {
  text: string
  start: number
  end: number
}

export interface ParsedAmazonDelivery {
  deliveryDays: string | null
  sourceText: string | null
}

const MINUTES_PER_HOUR = 60
const MILLISECONDS_PER_MINUTE = 60_000
const DATE_ONLY_FORMAT = 'YYYY-MM-DD'
const LOCAL_DATE_FORMAT = 'YYYY-M-D'
const FULL_WIDTH_DIGIT_START = '０'.charCodeAt(0)
const ASCII_DIGIT_START = '0'.charCodeAt(0)
const FULL_WIDTH_DIGIT_RE = /[０-９]/g
const DELIVERY_TEXT_SELECTORS = [
  '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE',
  '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE',
  '#deliveryBlockMessage',
  '#ddmDeliveryMessage',
  '#delivery-message',
  '[data-csa-c-content-id*="DELIVERY"]'
] as const
const DELIVERY_DATE_FORMATS = [
  'MMMM D, YYYY',
  'D MMM YYYY',
  'YYYY/MM/DD',
  'D MMMM',
  'D MMM',
  'M月D日',
  'YYYY年M月D日'
] as const
const JAPANESE_DATE_FORMATS = ['YYYY年M月D日', 'M月D日'] as const
const ENGLISH_DATE_FORMATS = ['MMMM D', 'MMM D', 'D MMMM', 'D MMM'] as const
const SPANISH_DATE_FORMATS = ['D MMMM YYYY', 'D MMMM', 'D MMM'] as const

const DELIVERY_STATIONS: Record<string, DeliveryStationConfig> = {
  JP: { code: 'JP', timezoneOffset: 9, locale: 'ja' },
  IN: { code: 'IN', timezoneOffset: 10, locale: 'en' },
  UK: { code: 'UK', timezoneOffset: 4, locale: 'en' },
  DE: { code: 'DE', timezoneOffset: 3, locale: 'de' },
  FR: { code: 'FR', timezoneOffset: 3, locale: 'fr' },
  US: { code: 'US', timezoneOffset: -3, locale: 'en' },
  IT: { code: 'IT', timezoneOffset: 1, locale: 'it' },
  ES: { code: 'ES', timezoneOffset: 1, locale: 'es' },
  CA: { code: 'CA', timezoneOffset: 1, locale: 'en' },
  MX: { code: 'MX', timezoneOffset: 1, locale: 'es' },
  BR: { code: 'BR', timezoneOffset: 1, locale: 'pt' }
}
const DEFAULT_DELIVERY_STATION = { code: 'US', timezoneOffset: 1, locale: 'en' }

function normalizeDigits(text: string): string {
  return text.replace(FULL_WIDTH_DIGIT_RE, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - FULL_WIDTH_DIGIT_START + ASCII_DIGIT_START)
  )
}

function normalizeText(text: string): string {
  return normalizeDigits(text).replace(/\s+/g, ' ').trim()
}

function getStationConfig(marketplaceCode?: string): DeliveryStationConfig {
  return DELIVERY_STATIONS[(marketplaceCode || 'US').toUpperCase()] || DEFAULT_DELIVERY_STATION
}

function getMarketplaceToday(station: DeliveryStationConfig): Date {
  const now = new Date()
  const utcTime = now.getTime() + MILLISECONDS_PER_MINUTE * now.getTimezoneOffset()
  const localTime = new Date(
    utcTime + MILLISECONDS_PER_MINUTE * MINUTES_PER_HOUR * station.timezoneOffset
  )

  return new Date(localTime.getFullYear(), localTime.getMonth(), localTime.getDate())
}

function parseWithLocale(text: string, formats: readonly string[], locale: string): Date | null {
  const originalLocale = moment.locale()
  moment.locale(locale)
  const parsed = moment(text, [...formats], true)
  moment.locale(originalLocale)
  return parsed.isValid() ? parsed.toDate() : null
}

function parseDate(station: DeliveryStationConfig, text: string): Date | null {
  if (!text || text.length < 4) return null

  let normalized = text.trim()
  if (normalized.includes('Review') && normalized.includes(' am ')) {
    normalized = normalized.substring(normalized.indexOf('am') + 2).trim()
  }
  if (normalized.includes('Commenté') && normalized.includes(' le ')) {
    normalized = normalized.substring(normalized.indexOf('le') + 2).trim()
  }
  if (
    (normalized.includes('Revisionato') || normalized.includes('Recensito')) &&
    normalized.includes(' il ')
  ) {
    normalized = normalized.substring(normalized.indexOf('il') + 2).trim()
  }
  if (
    (normalized.includes('Revisado') || normalized.includes('Reseñado')) &&
    normalized.includes(' el ')
  ) {
    normalized = normalized.substring(normalized.indexOf('el') + 2).trim()
  }
  if (normalized.includes('Rezension') && normalized.includes(' vom ')) {
    normalized = normalized.substring(normalized.indexOf('vom') + 3).trim()
  }
  if (normalized.includes('Rezension') && normalized.includes(' am ')) {
    normalized = normalized.substring(normalized.indexOf('am') + 2).trim()
  }
  if (/Avaliado (.*) em/.test(normalized)) {
    normalized = normalized.substring(normalized.lastIndexOf('em') + 2).trim()
  }
  if (normalized.includes('に'))
    normalized = normalized.substring(0, normalized.indexOf('に')).trim()
  if (normalized.includes(' on ')) {
    normalized = normalized.substring(normalized.indexOf('on') + 2).trim()
  }

  if (normalized.length < 4) return null

  const parsedMilliseconds = Date.parse(normalized)
  if (!Number.isNaN(parsedMilliseconds)) return new Date(parsedMilliseconds)

  return parseWithLocale(normalized, DELIVERY_DATE_FORMATS, station.locale)
}

function parseSingleDate(station: DeliveryStationConfig, rawText: string): Date | null {
  let text = rawText.trim()
  if (text.indexOf(',') > 0) text = text.substring(text.indexOf(',') + 1).trim()
  text = text.replace(/^(entre el|el|entre)\s+/i, '').trim()

  if (station.code === 'JP' || text.includes('月')) {
    text = text.replace(/([0-9０-９]+\s*月\s*[0-9０-９]+\s*日).*/, '$1').trim()
  }

  let parsedDate = /^\d+$/.test(text) ? null : parseDate(station, text)
  if (!parsedDate && /\bde\b/i.test(text)) {
    parsedDate = parseWithLocale(text.replace(/\sde\s/gi, ' ').trim(), SPANISH_DATE_FORMATS, 'es')
  }

  if (parsedDate && parsedDate.getFullYear() < 1000) parsedDate = null
  if (!parsedDate && (station.code === 'JP' || text.includes('月'))) {
    parsedDate = parseWithLocale(
      text,
      JAPANESE_DATE_FORMATS,
      station.code === 'JP' ? 'ja' : moment.locale()
    )
  }
  if (parsedDate?.getFullYear() === 2001) parsedDate.setFullYear(new Date().getFullYear())
  if (!parsedDate) parsedDate = parseWithLocale(text, ENGLISH_DATE_FORMATS, 'en')
  if (parsedDate?.getFullYear() === 2001) parsedDate.setFullYear(new Date().getFullYear())

  return parsedDate
}

function parseDeliveryDateRange(station: DeliveryStationConfig, value: string): Date[] {
  if (!value) return []

  const text = normalizeText(value)
  if (/^\d+\s*(mins?|minutes?|m)?$/i.test(text)) {
    const today = getMarketplaceToday(station)
    return [today, today]
  }

  const lowerText = text.toLowerCase()
  const isToday = [
    'today',
    'heute',
    "aujourd'hui",
    'oggi',
    'hoy',
    'hoje',
    '今日',
    'overnight'
  ].some((keyword) => lowerText.includes(keyword))
  const isTomorrow = ['tomorrow', 'morgen', 'demain', 'domani', 'mañana', 'amanhã', '明日'].some(
    (keyword) => lowerText.includes(keyword)
  )

  if ((isToday || isTomorrow) && !text.includes(',')) {
    const today = getMarketplaceToday(station)
    if (isTomorrow) today.setDate(today.getDate() + 1)
    return [today, today]
  }

  const segments = text.includes(' - ')
    ? text.split(' - ')
    : text.includes(' – ')
      ? text.split(' – ')
      : text.includes('-')
        ? text.split('-')
        : [text]
  let startDate = parseSingleDate(station, segments[0])
  let endDate: Date | null = null

  if (!startDate && segments.length > 1) {
    const parsedEnd = parseSingleDate(station, segments[1])
    if (parsedEnd) {
      endDate = parsedEnd
      const rawStart = segments[0]
        .trim()
        .replace(/^(entre el|el|entre)\s+/i, '')
        .trim()
      const onlyNumberMatch = rawStart.match(/^(\d+)$/)
      if (onlyNumberMatch) {
        const startDay = Number.parseInt(onlyNumberMatch[1], 10)
        startDate = new Date(parsedEnd)
        startDate.setDate(startDay)
        if (startDay > parsedEnd.getDate()) {
          startDate = new Date(parsedEnd.getFullYear(), parsedEnd.getMonth() - 1, startDay)
        }
      }
    }
  }

  if (!startDate) return []

  if (!endDate) {
    if (segments.length > 1) {
      const rawEnd = segments[1].trim()
      endDate = parseSingleDate(station, rawEnd)
      if (!endDate) {
        const onlyNumberMatch = rawEnd.match(/^(\d+)/)
        if (onlyNumberMatch) {
          const endDay = Number.parseInt(onlyNumberMatch[1], 10)
          endDate = new Date(startDate)
          endDate.setDate(endDay)
          if (endDay < startDate.getDate()) endDate.setMonth(endDate.getMonth() + 1)
        }
      }
    } else {
      endDate = startDate
    }
  }

  return [startDate, endDate || startDate]
}

export function getAmazonDeliveryInfo(
  marketplaceCode: string,
  deliveryText: string
): AmazonDeliveryInfo | null {
  if (!deliveryText) return null

  const station = getStationConfig(marketplaceCode)
  const range = parseDeliveryDateRange(station, deliveryText)
  if (range.length === 0) return null

  const localToday = getMarketplaceToday(station)
  const localTodayMoment = moment(
    `${localToday.getFullYear()}-${localToday.getMonth() + 1}-${localToday.getDate()}`,
    LOCAL_DATE_FORMAT
  )
  const getDiffDays = (targetDate: Date): number =>
    moment(moment(targetDate).format(DATE_ONLY_FORMAT), DATE_ONLY_FORMAT).diff(
      localTodayMoment,
      'days'
    )
  const start = getDiffDays(range[0])
  const end = getDiffDays(range[1])

  if (start < 0) return null

  return {
    text: start === end ? (start === 0 ? '1' : String(start)) : `${start}-${end}`,
    start,
    end
  }
}

export function parseAmazonDeliveryDetailHtml(
  html: string,
  marketplace: AmazonMarketplace
): ParsedAmazonDelivery {
  const $ = cheerio.load(html)
  const candidates = new Set<string>()
  const addCandidate = (value?: string | null): void => {
    const text = value ? normalizeText(value) : ''
    if (text) candidates.add(text)
  }

  for (const selector of DELIVERY_TEXT_SELECTORS) {
    $(selector).each((_index, element) => addCandidate($(element).text()))
  }
  $('[data-csa-c-delivery-time]').each((_index, element) => {
    addCandidate($(element).attr('data-csa-c-delivery-time'))
  })

  for (const sourceText of candidates) {
    const deliveryInfo = getAmazonDeliveryInfo(marketplace, sourceText)
    if (deliveryInfo) {
      return { deliveryDays: deliveryInfo.text, sourceText }
    }
  }

  return {
    deliveryDays: null,
    sourceText: candidates.values().next().value || null
  }
}
