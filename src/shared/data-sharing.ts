export const DATA_SHARING_SERVICE_TYPE = 'sellerflow'
export const DATA_SHARING_API_PREFIX = '/api/shared'
export const DATA_SHARING_PROTOCOL_VERSION = '1'

export type DataSharingSortOrder = 'ASC' | 'DESC'

export interface DataSharingProductQueryFilter {
  taskId?: number
  query?: string
  category?: string
  sellerType?: string
  minPrice?: number
  maxPrice?: number
  limit?: number
  offset?: number
  sortBy?: string
  sortOrder?: DataSharingSortOrder
  hasSellerSpriteData?: boolean
}

export interface DataSharingSearchKeywordQueryFilter {
  taskId?: number
  limit?: number
  offset?: number
  sortBy?: string
  sortOrder?: DataSharingSortOrder
}

export interface SharedDataSource {
  id: string
  name: string
  host: string
  port: number
  baseUrl: string
  deviceId: string
  hostname?: string
  sourceType?: 'mdns' | 'manual' | 'cache'
  lastSeenAt: string
}

export interface DataSharingStatus {
  enabled: boolean
  running: boolean
  port: number | null
  baseUrl: string | null
  baseUrls?: string[]
  deviceId: string
  displayName: string
  error?: string
}

export interface DataSharingApi {
  getStatus: () => Promise<DataSharingStatus>
  discoverSources: () => Promise<SharedDataSource[]>
  connectManualSource: (host: string, port: number) => Promise<SharedDataSource>
  getRemoteTasks: (source: SharedDataSource) => Promise<unknown[]>
  getRemoteCategories: (source: SharedDataSource, taskId: number) => Promise<string[]>
  getRemoteSellerTypes: (source: SharedDataSource, taskId: number) => Promise<string[]>
  queryRemoteProducts: (
    source: SharedDataSource,
    filter: DataSharingProductQueryFilter
  ) => Promise<{ total: number; list: unknown[] }>
  queryRemoteSearchKeywords: (
    source: SharedDataSource,
    filter: DataSharingSearchKeywordQueryFilter
  ) => Promise<{ total: number; list: unknown[] }>
  getRemoteSearchKeywordProducts: (
    source: SharedDataSource,
    keywordId: number
  ) => Promise<unknown[]>
  getRemoteProductBsrRanks: (source: SharedDataSource, productId: number) => Promise<unknown[]>
  markRemoteSearchKeywordAsRead: (source: SharedDataSource, keywordId: number) => Promise<boolean>
  markRemoteProductAsRead: (source: SharedDataSource, productId: number) => Promise<boolean>
}

export function isSharedDataSource(value: unknown): value is SharedDataSource {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const source = value as Record<string, unknown>

  return (
    typeof source.id === 'string' &&
    typeof source.name === 'string' &&
    typeof source.host === 'string' &&
    typeof source.port === 'number' &&
    typeof source.baseUrl === 'string' &&
    typeof source.deviceId === 'string' &&
    typeof source.lastSeenAt === 'string' &&
    (source.hostname === undefined || typeof source.hostname === 'string') &&
    (source.sourceType === undefined ||
      source.sourceType === 'mdns' ||
      source.sourceType === 'manual' ||
      source.sourceType === 'cache')
  )
}

export function isDataSharingStatus(value: unknown): value is DataSharingStatus {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const status = value as Record<string, unknown>

  return (
    typeof status.enabled === 'boolean' &&
    typeof status.running === 'boolean' &&
    (status.port === null || typeof status.port === 'number') &&
    (status.baseUrl === null || typeof status.baseUrl === 'string') &&
    (status.baseUrls === undefined ||
      (Array.isArray(status.baseUrls) &&
        status.baseUrls.every((baseUrl) => typeof baseUrl === 'string'))) &&
    typeof status.deviceId === 'string' &&
    typeof status.displayName === 'string' &&
    (status.error === undefined || typeof status.error === 'string')
  )
}
