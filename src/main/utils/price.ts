import { CURRENCY, CURRENCY_MARKERS, type Currency } from '../config/price'
import type { ParsedPrice } from '../types/database'

export function parsePriceField(
  rawPrice: string,
  defaultCurrency: Currency = CURRENCY.JPY
): ParsedPrice {
  if (!rawPrice) return { currency: defaultCurrency, amount: 0 }

  let currency = defaultCurrency
  const upperPrice = rawPrice.toUpperCase()

  for (const [candidate, markers] of Object.entries(CURRENCY_MARKERS) as Array<
    [Currency, readonly string[]]
  >) {
    if (markers.some((marker) => rawPrice.includes(marker) || upperPrice.includes(marker))) {
      currency = candidate
      break
    }
  }

  const numbersOnly = rawPrice.replace(/[^\d.]/g, '')
  const amount = parseFloat(numbersOnly) || 0

  return { currency, amount }
}
