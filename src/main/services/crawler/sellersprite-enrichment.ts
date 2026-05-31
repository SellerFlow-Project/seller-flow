import type { AmazonParsedProduct } from '../../types/amazon'
import type { IncomingCrawledProduct, ProductSellerSpriteData } from '../../types/database'
import type {
  SellerSpriteBsrItem,
  SellerSpriteQuickViewItem,
  SellerSpriteQuickViewResponse
} from '../../types/sellersprite'

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function normalizeBsrList(rawList: unknown): ProductSellerSpriteData['bsrList'] {
  if (!Array.isArray(rawList)) return []

  return rawList
    .map((item): ProductSellerSpriteData['bsrList'][number] | null => {
      const bsr = item as SellerSpriteBsrItem
      const rank = toOptionalNumber(bsr.rank)
      const id = toOptionalString(bsr.id)

      if (rank === undefined || !id) return null

      return {
        rank,
        main: bsr.main === true,
        id,
        label: toOptionalString(bsr.label) || '',
        text: toOptionalString(bsr.text) || '',
        href: toOptionalString(bsr.href) || ''
      }
    })
    .filter((item): item is ProductSellerSpriteData['bsrList'][number] => Boolean(item))
}

function normalizeSellerSpriteItem(item: SellerSpriteQuickViewItem): ProductSellerSpriteData {
  return {
    sellerType: toOptionalString(item.seller_type),
    units: toOptionalNumber(item.units),
    available: toOptionalNumber(item.available),
    bsrList: normalizeBsrList(item.bsrList)
  }
}

function hasSellerSpritePayload(data: ProductSellerSpriteData): boolean {
  return Boolean(
    data.sellerType ||
      data.units !== undefined ||
      data.available !== undefined ||
      data.bsrList.length > 0
  )
}

export function buildSellerSpriteDetailsByAsin(
  response?: SellerSpriteQuickViewResponse | null
): Map<string, ProductSellerSpriteData> {
  const detailsByAsin = new Map<string, ProductSellerSpriteData>()
  const items = response?.data?.items

  if (!Array.isArray(items)) return detailsByAsin

  for (const item of items) {
    const asin = toOptionalString(item.asin)
    if (!asin) continue

    const details = normalizeSellerSpriteItem(item)
    if (hasSellerSpritePayload(details)) {
      detailsByAsin.set(asin, details)
    }
  }

  return detailsByAsin
}

export function mergeProductsWithSellerSpriteDetails(
  products: AmazonParsedProduct[],
  response?: SellerSpriteQuickViewResponse | null
): IncomingCrawledProduct[] {
  const detailsByAsin = buildSellerSpriteDetailsByAsin(response)

  return products.map((product) => ({
    ...product,
    sellerSprite: detailsByAsin.get(product.asin)
  }))
}
