export type ThemeMode = 'light' | 'dark'
export type ThemeColor = 'blue' | 'emerald' | 'violet' | 'amber' | 'rose'
export type UiScaleMode = 'auto' | '0.8' | '0.9' | '1.0' | '1.1' | '1.2' | '1.5'
export type CrawlerProxyMode = 'direct' | 'mihomo-node-pool'
export type CrawlerProxyNodeStrategy =
  | 'sticky-10-minutes'
  | 'round-robin'
  | 'random'
  | 'lowest-latency'

export interface ApplicationSettings {
  theme: ThemeMode
  themeColor: ThemeColor
  uiScale: UiScaleMode
}

export interface NotificationSettings {
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  notifySuccess: boolean
  notifyFailure: boolean
}

export interface CrawlingSettings {
  clearHistoryOnNewTask: boolean
  concurrencyCount: number
  minDelay: number
  maxDelay: number
  proxyMode: CrawlerProxyMode
  proxyNodeStrategy: CrawlerProxyNodeStrategy
  mihomoEnabled: boolean
  mihomoSubscriptionUrl: string
  mihomoBinaryPath: string
  mihomoControllerPort: number
  mihomoMixedPortStart: number
  mihomoMaxNodeCount: number
  mihomoHealthCheckUrl: string
}

export interface AiSettings {
  textApiEndpoint: string
  textModelName: string
  textApiKey: string
  imageApiEndpoint: string
  imageModelName: string
  imageApiKey: string
}

export interface DataSharingSettings {
  serverEnabled: boolean
  serverPort: number
  deviceId: string
  displayName: string
}

export interface SellerFlowSettings {
  application: ApplicationSettings
  notifications: NotificationSettings
  crawling: CrawlingSettings
  ai: AiSettings
  dataSharing: DataSharingSettings
}

export interface SettingsApi {
  get: () => Promise<SellerFlowSettings>
  save: (settings: SellerFlowSettings) => Promise<SellerFlowSettings>
  updateApplication: (settings: Partial<ApplicationSettings>) => Promise<ApplicationSettings>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isApplicationSettings(value: unknown): value is ApplicationSettings {
  if (!isRecord(value)) {
    return false
  }

  return (
    (value.theme === 'light' || value.theme === 'dark') &&
    ['blue', 'emerald', 'violet', 'amber', 'rose'].includes(value.themeColor as string) &&
    ['auto', '0.8', '0.9', '1.0', '1.1', '1.2', '1.5'].includes(value.uiScale as string)
  )
}

export function isSellerFlowSettings(value: unknown): value is SellerFlowSettings {
  if (!isRecord(value)) {
    return false
  }

  const notifications = value.notifications
  const crawling = value.crawling
  const ai = value.ai

  return (
    isApplicationSettings(value.application) &&
    isRecord(notifications) &&
    typeof notifications.smtpHost === 'string' &&
    typeof notifications.smtpPort === 'string' &&
    typeof notifications.smtpUser === 'string' &&
    typeof notifications.smtpPass === 'string' &&
    typeof notifications.notifySuccess === 'boolean' &&
    typeof notifications.notifyFailure === 'boolean' &&
    isRecord(crawling) &&
    typeof crawling.clearHistoryOnNewTask === 'boolean' &&
    typeof crawling.concurrencyCount === 'number' &&
    typeof crawling.minDelay === 'number' &&
    typeof crawling.maxDelay === 'number' &&
    (crawling.proxyMode === 'direct' || crawling.proxyMode === 'mihomo-node-pool') &&
    ['sticky-10-minutes', 'round-robin', 'random', 'lowest-latency'].includes(
      crawling.proxyNodeStrategy as string
    ) &&
    typeof crawling.mihomoEnabled === 'boolean' &&
    typeof crawling.mihomoSubscriptionUrl === 'string' &&
    typeof crawling.mihomoBinaryPath === 'string' &&
    typeof crawling.mihomoControllerPort === 'number' &&
    typeof crawling.mihomoMixedPortStart === 'number' &&
    typeof crawling.mihomoMaxNodeCount === 'number' &&
    typeof crawling.mihomoHealthCheckUrl === 'string' &&
    isRecord(ai) &&
    typeof ai.textApiEndpoint === 'string' &&
    typeof ai.textModelName === 'string' &&
    typeof ai.textApiKey === 'string' &&
    typeof ai.imageApiEndpoint === 'string' &&
    typeof ai.imageModelName === 'string' &&
    typeof ai.imageApiKey === 'string' &&
    isRecord(value.dataSharing) &&
    typeof value.dataSharing.serverEnabled === 'boolean' &&
    typeof value.dataSharing.serverPort === 'number' &&
    typeof value.dataSharing.deviceId === 'string' &&
    typeof value.dataSharing.displayName === 'string'
  )
}

export const DEFAULT_SELLER_FLOW_SETTINGS: SellerFlowSettings = {
  application: {
    theme: 'light',
    themeColor: 'blue',
    uiScale: 'auto'
  },
  notifications: {
    smtpHost: 'smtp.qq.com',
    smtpPort: '465',
    smtpUser: 'sellerflow_notify@qq.com',
    smtpPass: '',
    notifySuccess: true,
    notifyFailure: true
  },
  crawling: {
    clearHistoryOnNewTask: true,
    concurrencyCount: 1,
    minDelay: 1,
    maxDelay: 3,
    proxyMode: 'direct',
    proxyNodeStrategy: 'sticky-10-minutes',
    mihomoEnabled: false,
    mihomoSubscriptionUrl: '',
    mihomoBinaryPath: '',
    mihomoControllerPort: 9097,
    mihomoMixedPortStart: 31001,
    mihomoMaxNodeCount: -1,
    mihomoHealthCheckUrl: 'https://www.gstatic.com/generate_204'
  },
  ai: {
    textApiEndpoint: 'https://api.deepseek.com/v1',
    textModelName: 'deepseek-chat',
    textApiKey: '',
    imageApiEndpoint: 'https://api.openai.com/v1',
    imageModelName: 'dall-e-3',
    imageApiKey: ''
  },
  dataSharing: {
    serverEnabled: false,
    serverPort: 48991,
    deviceId: '',
    displayName: 'SellerFlow 数据服务'
  }
}
