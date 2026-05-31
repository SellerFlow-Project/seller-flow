import { create } from 'zustand'
import { DEFAULT_TAB, INITIAL_EXPANDED_MENUS, PARENT_MENU_BY_TAB } from '../config/tabs'
import type { TabKey } from '../config/tabs'

export type { TabKey } from '../config/tabs'

export type ThemeMode = 'light' | 'dark'

interface AppState {
  activeTab: TabKey
  expandedMenus: Record<string, boolean>
  theme: ThemeMode
  setTab: (tab: TabKey) => void
  toggleMenu: (menuKey: string) => void
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

function getInitialTheme(): ThemeMode {
  return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: DEFAULT_TAB,
  expandedMenus: INITIAL_EXPANDED_MENUS,
  theme: getInitialTheme(),

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
  }
}))
