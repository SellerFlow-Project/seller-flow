import { create } from 'zustand'
import {
  DEFAULT_SELLER_FLOW_SETTINGS,
  type ApplicationSettings,
  type ThemeColor,
  type ThemeMode,
  type UiScaleMode
} from '../../../shared/settings'
import { DEFAULT_TAB, INITIAL_EXPANDED_MENUS, PARENT_MENU_BY_TAB } from '../config/tabs'
import type { TabKey } from '../config/tabs'
import {
  getPermissionsForRoles,
  hasPermission as userHasPermission,
  type AccountPermission,
  type AccountUser,
  type AuthStage
} from '../../../shared/account'

export type { TabKey } from '../config/tabs'
export type { ThemeColor, ThemeMode, UiScaleMode } from '../../../shared/settings'

interface AppState {
  activeTab: TabKey
  expandedMenus: Record<string, boolean>
  theme: ThemeMode
  themeColor: ThemeColor
  uiScale: UiScaleMode
  authStage: AuthStage
  currentUser: AccountUser | null
  permissions: AccountPermission[]
  setTab: (tab: TabKey) => void
  toggleMenu: (menuKey: string) => void
  applyApplicationSettings: (settings: ApplicationSettings) => void
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  setUiScale: (scale: UiScaleMode) => void
  setThemeColor: (themeColor: ThemeColor) => void
  setAuthStage: (stage: AuthStage) => void
  setAuthenticatedUser: (user: AccountUser) => void
  clearAuthenticatedUser: () => void
  hasPermission: (permission: AccountPermission) => boolean
}

const THEME_COLORS: Record<ThemeColor, string> = {
  blue: '221.2 83.2% 53.3%',
  emerald: '160.1 84.1% 39.4%',
  violet: '262.1 83.3% 57.8%',
  amber: '37.7 92.1% 50.2%',
  rose: '346.8 77.2% 49.8%'
}

function applyApplicationSettingsToDocument(settings: ApplicationSettings): void {
  document.documentElement.classList.toggle('dark', settings.theme === 'dark')
  document.documentElement.style.setProperty('--primary', THEME_COLORS[settings.themeColor])
  document.documentElement.style.setProperty('--ring', THEME_COLORS[settings.themeColor])
}

function persistApplicationSettings(settings: Partial<ApplicationSettings>): void {
  void window.api.settings.updateApplication(settings).catch((error) => {
    console.error('[Settings] 保存应用程序设置失败：', error)
  })
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: DEFAULT_TAB,
  expandedMenus: INITIAL_EXPANDED_MENUS,
  theme: DEFAULT_SELLER_FLOW_SETTINGS.application.theme,
  themeColor: DEFAULT_SELLER_FLOW_SETTINGS.application.themeColor,
  uiScale: DEFAULT_SELLER_FLOW_SETTINGS.application.uiScale,
  authStage: 'splash',
  currentUser: null,
  permissions: [],

  setAuthStage: (stage) => set({ authStage: stage }),

  setAuthenticatedUser: (user) =>
    set({
      currentUser: user,
      permissions: getPermissionsForRoles(user.roles),
      authStage: 'main'
    }),

  clearAuthenticatedUser: () =>
    set({
      currentUser: null,
      permissions: [],
      authStage: 'login',
      activeTab: DEFAULT_TAB
    }),

  hasPermission: (permission) => userHasPermission(get().currentUser, permission),

  setTab: (tab) =>
    set((state) => {
      const updates: Partial<AppState> = { activeTab: tab }
      const parentMenuKey = PARENT_MENU_BY_TAB[tab]

      if (parentMenuKey) {
        updates.expandedMenus = { ...state.expandedMenus, [parentMenuKey]: true }
      }

      return updates
    }),

  toggleMenu: (menuKey) =>
    set((state) => ({
      expandedMenus: {
        ...state.expandedMenus,
        [menuKey]: !state.expandedMenus[menuKey]
      }
    })),

  applyApplicationSettings: (settings) => {
    const nextSettings = settings || DEFAULT_SELLER_FLOW_SETTINGS.application
    applyApplicationSettingsToDocument(nextSettings)
    set(nextSettings)
  },

  setTheme: (theme) => {
    const settings = {
      theme,
      themeColor: get().themeColor,
      uiScale: get().uiScale
    }
    get().applyApplicationSettings(settings)
    persistApplicationSettings({ theme })
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'light' ? 'dark' : 'light'
    get().setTheme(nextTheme)
  },

  setUiScale: (scale) => {
    set({ uiScale: scale })
    persistApplicationSettings({ uiScale: scale })
  },

  setThemeColor: (themeColor) => {
    const settings = {
      theme: get().theme,
      themeColor,
      uiScale: get().uiScale
    }
    get().applyApplicationSettings(settings)
    persistApplicationSettings({ themeColor })
  }
}))
