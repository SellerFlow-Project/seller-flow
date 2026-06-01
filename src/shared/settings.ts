export type ThemeMode = 'light' | 'dark'
export type ThemeColor = 'blue' | 'emerald' | 'violet' | 'amber' | 'rose'
export type UiScaleMode = 'auto' | '0.8' | '0.9' | '1.0' | '1.1' | '1.2' | '1.5'

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
}

export interface AiSettings {
  textApiEndpoint: string
  textModelName: string
  textApiKey: string
  imageApiEndpoint: string
  imageModelName: string
  imageApiKey: string
}

export interface SellerFlowSettings {
  application: ApplicationSettings
  notifications: NotificationSettings
  crawling: CrawlingSettings
  ai: AiSettings
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
    isRecord(ai) &&
    typeof ai.textApiEndpoint === 'string' &&
    typeof ai.textModelName === 'string' &&
    typeof ai.textApiKey === 'string' &&
    typeof ai.imageApiEndpoint === 'string' &&
    typeof ai.imageModelName === 'string' &&
    typeof ai.imageApiKey === 'string'
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
    maxDelay: 3
  },
  ai: {
    textApiEndpoint: 'https://api.deepseek.com/v1',
    textModelName: 'deepseek-chat',
    textApiKey: '',
    imageApiEndpoint: 'https://api.openai.com/v1',
    imageModelName: 'dall-e-3',
    imageApiKey: ''
  }
}
