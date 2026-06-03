export const DEFAULT_TAB = 'dashboard'

export const TAB_KEYS = [
  'dashboard',
  'amazon-collection',
  'data-browsing',
  'data-deletion',
  'ai-functions',
  'seller-sprite',
  'settings',
  'account-admin'
] as const

export type TabKey = (typeof TAB_KEYS)[number]

export const INITIAL_EXPANDED_MENUS: Record<string, boolean> = {
  'data-collection': true,
  'data-management': true
}

export const PARENT_MENU_BY_TAB: Partial<Record<TabKey, string>> = {
  'amazon-collection': 'data-collection',
  'data-browsing': 'data-management',
  'data-deletion': 'data-management'
}
