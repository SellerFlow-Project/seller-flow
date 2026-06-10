import Store from 'electron-store'
import type {
  AmazonSearchConfig,
  Amz123Session
} from '../../shared/amazon-search'

interface AmazonSearchStore {
  session: Amz123Session | null
  config: AmazonSearchConfig
}

const DEFAULT_CONFIG: AmazonSearchConfig = {
  marketplace: 'JP',
  selectedRanks: ['全部'],
  selectedChanges: ['全部'],
  minDeliveryInterval: 0,
  maxDeliveryInterval: 30,
  matchingProductCount: 1,
  concurrency: 5
}

let store: Store<AmazonSearchStore> | undefined

function getStore(): Store<AmazonSearchStore> {
  store ??= new Store<AmazonSearchStore>({
    name: 'amazon-search',
    defaults: {
      session: null,
      config: DEFAULT_CONFIG
    }
  })

  return store
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback

  const items = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0
  )
  return items.length > 0 ? items : fallback
}

function normalizeNumber(value: unknown, fallback: number, min = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.floor(value))
}

function normalizeSession(value: unknown): Amz123Session | null {
  if (!value || typeof value !== 'object') return null

  const session = value as Partial<Amz123Session>
  if (!session.token || !session.username || !session.expire) return null

  return {
    token: String(session.token),
    username: String(session.username),
    avatar: typeof session.avatar === 'string' ? session.avatar : undefined,
    expire: Number(session.expire),
    appUid: typeof session.appUid === 'number' ? session.appUid : undefined,
    roleIdList: Array.isArray(session.roleIdList)
      ? session.roleIdList.map((role) => Number(role)).filter((role) => Number.isFinite(role))
      : []
  }
}

function normalizeConfig(value: unknown): AmazonSearchConfig {
  const raw = typeof value === 'object' && value !== null ? (value as Partial<AmazonSearchConfig>) : {}
  const minDeliveryInterval = normalizeNumber(
    raw.minDeliveryInterval,
    DEFAULT_CONFIG.minDeliveryInterval
  )
  const maxDeliveryInterval = Math.max(
    minDeliveryInterval,
    normalizeNumber(raw.maxDeliveryInterval, DEFAULT_CONFIG.maxDeliveryInterval)
  )

  return {
    marketplace:
      raw.marketplace === 'JP' || raw.marketplace === 'US' || raw.marketplace === 'UK' || raw.marketplace === 'DE'
        ? raw.marketplace
        : DEFAULT_CONFIG.marketplace,
    selectedRanks: normalizeStringArray(raw.selectedRanks, DEFAULT_CONFIG.selectedRanks),
    selectedChanges: normalizeStringArray(raw.selectedChanges, DEFAULT_CONFIG.selectedChanges),
    minDeliveryInterval,
    maxDeliveryInterval,
    matchingProductCount: normalizeNumber(
      raw.matchingProductCount,
      DEFAULT_CONFIG.matchingProductCount,
      1
    ),
    concurrency: normalizeNumber(
      raw.concurrency,
      DEFAULT_CONFIG.concurrency,
      1
    )
  }
}

export function getAmazonSearchConfig(): AmazonSearchConfig {
  const config = normalizeConfig(getStore().get('config'))
  getStore().set('config', config)
  return config
}

export function saveAmazonSearchConfig(config: AmazonSearchConfig): AmazonSearchConfig {
  const normalizedConfig = normalizeConfig(config)
  getStore().set('config', normalizedConfig)
  return normalizedConfig
}

export function getAmz123Session(): Amz123Session | null {
  const session = normalizeSession(getStore().get('session'))
  getStore().set('session', session)
  return session
}

export function saveAmz123Session(session: Amz123Session): Amz123Session {
  const normalizedSession = normalizeSession(session)
  if (!normalizedSession) {
    throw new Error('AMZ123 登录态数据不完整，无法保存。')
  }

  getStore().set('session', normalizedSession)
  return normalizedSession
}

export function clearAmz123Session(): void {
  getStore().set('session', null)
}

export function isAmz123SessionValid(session: Amz123Session | null): session is Amz123Session {
  if (!session) return false
  return session.expire * 1000 > Date.now() + 60_000
}
