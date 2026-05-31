import type { ParsedPrice } from '../types/database'

export function parsePriceField(rawPrice: string, defaultCurrency = 'JPY'): ParsedPrice {
  if (!rawPrice) return { currency: defaultCurrency, amount: 0 }

  let currency = defaultCurrency
  const upperPrice = rawPrice.toUpperCase()

  if (rawPrice.includes('￥') || rawPrice.includes('¥') || upperPrice.includes('JPY')) {
    currency = 'JPY'
  } else if (rawPrice.includes('$') || upperPrice.includes('USD')) {
    currency = 'USD'
  } else if (rawPrice.includes('£') || upperPrice.includes('GBP')) {
    currency = 'GBP'
  } else if (rawPrice.includes('€') || upperPrice.includes('EUR')) {
    currency = 'EUR'
  }

  const numbersOnly = rawPrice.replace(/[^\d.]/g, '')
  const amount = parseFloat(numbersOnly) || 0

  return { currency, amount }
}
