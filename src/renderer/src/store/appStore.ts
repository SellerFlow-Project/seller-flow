import { create } from 'zustand'
import { DEFAULT_TAB, INITIAL_EXPANDED_MENUS, PARENT_MENU_BY_TAB } from '../config/tabs'
import type { TabKey } from '../config/tabs'

export type { TabKey } from '../config/tabs'

export type ThemeMode = 'light' | 'dark'
export type UiScaleMode = 'auto' | '0.8' | '0.9' | '1.0' | '1.1' | '1.2' | '1.5'

interface AppState {
  activeTab: TabKey
  expandedMenus: Record<string, boolean>
  theme: ThemeMode
  uiScale: UiScaleMode
  setTab: (tab: TabKey) => void
  toggleMenu: (menuKey: string) => void
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  setUiScale: (scale: UiScaleMode) => void
}

function getInitialTheme(): ThemeMode {
  return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
}

function getInitialUiScale(): UiScaleMode {
  return (localStorage.getItem('uiScale') as UiScaleMode) || 'auto'
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: DEFAULT_TAB,
  expandedMenus: INITIAL_EXPANDED_MENUS,
  theme: getInitialTheme(),
  uiScale: getInitialUiScale(),

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

  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    set({ theme })
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'light' ? 'dark' : 'light'
    get().setTheme(nextTheme)
  },

  setUiScale: (scale) => {
    localStorage.setItem('uiScale', scale)
    set({ uiScale: scale })
  }
}))
