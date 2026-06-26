import Store from 'electron-store'
import { randomUUID } from 'crypto'
import {
  DEFAULT_SELLER_FLOW_SETTINGS,
  DEMO_MIHOMO_SUBSCRIPTION_URL,
  type ApplicationSettings,
  type CrawlingSettings,
  type SellerFlowSettings,
  type ThemeColor,
  type ThemeMode,
  type UiScaleMode
} from '../../shared/settings'

interface SettingsStore {
  settings: SellerFlowSettings
}

const THEME_MODES = new Set<ThemeMode>(['light', 'dark'])
const THEME_COLORS = new Set<ThemeColor>(['blue', 'emerald', 'violet', 'amber', 'rose'])
const UI_SCALE_MODES = new Set<UiScaleMode>(['auto', '0.8', '0.9', '1.0', '1.1', '1.2', '1.5'])

let store: Store<SettingsStore> | undefined

function getStore(): Store<SettingsStore> {
  store ??= new Store<SettingsStore>({
    name: 'settings',
    defaults: {
      settings: DEFAULT_SELLER_FLOW_SETTINGS
    }
  })

  return store
}

function getString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function getBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function getNumber(value: unknown, fallback: number, minimum: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(minimum, value) : fallback
}

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

export function normalizeSettings(value: unknown): SellerFlowSettings {
  const settings = getRecord(value)
  const application = getRecord(settings.application)
  const notifications = getRecord(settings.notifications)
  const crawling = getRecord(settings.crawling)
  const ai = getRecord(settings.ai)
  const dataSharing = getRecord(settings.dataSharing)
  const minDelay = getNumber(crawling.minDelay, DEFAULT_SELLER_FLOW_SETTINGS.crawling.minDelay, 0)
  const mihomoEnabled = getBoolean(
    crawling.mihomoEnabled,
    DEFAULT_SELLER_FLOW_SETTINGS.crawling.mihomoEnabled
  )
  const dataSharingDeviceId = getString(
    dataSharing.deviceId,
    DEFAULT_SELLER_FLOW_SETTINGS.dataSharing.deviceId
  )

  return {
    application: {
      theme: THEME_MODES.has(application.theme as ThemeMode)
        ? (application.theme as ThemeMode)
        : DEFAULT_SELLER_FLOW_SETTINGS.application.theme,
      themeColor: THEME_COLORS.has(application.themeColor as ThemeColor)
        ? (application.themeColor as ThemeColor)
        : DEFAULT_SELLER_FLOW_SETTINGS.application.themeColor,
      uiScale: UI_SCALE_MODES.has(application.uiScale as UiScaleMode)
        ? (application.uiScale as UiScaleMode)
        : DEFAULT_SELLER_FLOW_SETTINGS.application.uiScale
    },
    notifications: {
      smtpHost: getString(
        notifications.smtpHost,
        DEFAULT_SELLER_FLOW_SETTINGS.notifications.smtpHost
      ),
      smtpPort: getString(
        notifications.smtpPort,
        DEFAULT_SELLER_FLOW_SETTINGS.notifications.smtpPort
      ),
      smtpUser: getString(
        notifications.smtpUser,
        DEFAULT_SELLER_FLOW_SETTINGS.notifications.smtpUser
      ),
      smtpPass: getString(
        notifications.smtpPass,
        DEFAULT_SELLER_FLOW_SETTINGS.notifications.smtpPass
      ),
      notifySuccess: getBoolean(
        notifications.notifySuccess,
        DEFAULT_SELLER_FLOW_SETTINGS.notifications.notifySuccess
      ),
      notifyFailure: getBoolean(
        notifications.notifyFailure,
        DEFAULT_SELLER_FLOW_SETTINGS.notifications.notifyFailure
      )
    },
    crawling: {
      clearHistoryOnNewTask: getBoolean(
        crawling.clearHistoryOnNewTask,
        DEFAULT_SELLER_FLOW_SETTINGS.crawling.clearHistoryOnNewTask
      ),
      minDelay,
      maxDelay: Math.max(
        minDelay,
        getNumber(crawling.maxDelay, DEFAULT_SELLER_FLOW_SETTINGS.crawling.maxDelay, 0)
      ),
      proxyNodeStrategy: DEFAULT_SELLER_FLOW_SETTINGS.crawling.proxyNodeStrategy,
      mihomoEnabled,
      mihomoSubscriptionUrl: DEMO_MIHOMO_SUBSCRIPTION_URL,
      mihomoBinaryPath: DEFAULT_SELLER_FLOW_SETTINGS.crawling.mihomoBinaryPath,
      mihomoControllerPort: DEFAULT_SELLER_FLOW_SETTINGS.crawling.mihomoControllerPort,
      mihomoMixedPortStart: DEFAULT_SELLER_FLOW_SETTINGS.crawling.mihomoMixedPortStart,
      mihomoMaxNodeCount: DEFAULT_SELLER_FLOW_SETTINGS.crawling.mihomoMaxNodeCount,
      mihomoHealthCheckUrl: DEFAULT_SELLER_FLOW_SETTINGS.crawling.mihomoHealthCheckUrl
    },
    ai: {
      textApiEndpoint: getString(
        ai.textApiEndpoint,
        DEFAULT_SELLER_FLOW_SETTINGS.ai.textApiEndpoint
      ),
      textModelName: getString(ai.textModelName, DEFAULT_SELLER_FLOW_SETTINGS.ai.textModelName),
      textApiKey: getString(ai.textApiKey, DEFAULT_SELLER_FLOW_SETTINGS.ai.textApiKey),
      imageApiEndpoint: getString(
        ai.imageApiEndpoint,
        DEFAULT_SELLER_FLOW_SETTINGS.ai.imageApiEndpoint
      ),
      imageModelName: getString(ai.imageModelName, DEFAULT_SELLER_FLOW_SETTINGS.ai.imageModelName),
      imageApiKey: getString(ai.imageApiKey, DEFAULT_SELLER_FLOW_SETTINGS.ai.imageApiKey)
    },
    dataSharing: {
      serverEnabled: getBoolean(
        dataSharing.serverEnabled,
        DEFAULT_SELLER_FLOW_SETTINGS.dataSharing.serverEnabled
      ),
      serverPort: Math.floor(
        getNumber(dataSharing.serverPort, DEFAULT_SELLER_FLOW_SETTINGS.dataSharing.serverPort, 0)
      ),
      deviceId: dataSharingDeviceId || randomUUID(),
      displayName: getString(
        dataSharing.displayName,
        DEFAULT_SELLER_FLOW_SETTINGS.dataSharing.displayName
      )
    }
  }
}

export function getSettings(): SellerFlowSettings {
  const settings = normalizeSettings(getStore().get('settings'))
  getStore().set('settings', settings)
  return settings
}

export function saveSettings(settings: SellerFlowSettings): SellerFlowSettings {
  const normalizedSettings = normalizeSettings(settings)
  getStore().set('settings', normalizedSettings)
  return normalizedSettings
}

export function getCrawlingSettings(): CrawlingSettings {
  return normalizeSettings(getStore().get('settings')).crawling
}

export function updateApplicationSettings(
  settings: Partial<ApplicationSettings>
): ApplicationSettings {
  const currentSettings = getSettings()
  const normalizedSettings = saveSettings({
    ...currentSettings,
    application: {
      ...currentSettings.application,
      ...settings
    }
  })

  return normalizedSettings.application
}
