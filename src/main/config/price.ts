export const CURRENCY = {
  JPY: 'JPY',
  USD: 'USD',
  GBP: 'GBP',
  EUR: 'EUR'
} as const

export type Currency = (typeof CURRENCY)[keyof typeof CURRENCY]

export const CURRENCY_MARKERS: Record<Currency, readonly string[]> = {
  [CURRENCY.JPY]: ['￥', '¥', CURRENCY.JPY],
  [CURRENCY.USD]: ['$', CURRENCY.USD],
  [CURRENCY.GBP]: ['£', CURRENCY.GBP],
  [CURRENCY.EUR]: ['€', CURRENCY.EUR]
}
