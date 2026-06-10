import {
  Activity,
  Bot,
  Cpu,
  Database,
  FileSpreadsheet,
  Flame,
  LayoutGrid,
  Search,
  Settings,
  Trash2
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { AccountPermission, AccountUser } from '../../../shared/account'
import { hasPermission } from '../../../shared/account'
import type { TabKey } from './tabs'

export interface SidebarChild {
  key: TabKey
  title: string
  icon: ReactNode
  requiredPermission?: AccountPermission
}

export type SidebarItem =
  | {
      type: 'item'
      key: TabKey
      title: string
      icon: ReactNode
      requiredPermission?: AccountPermission
    }
  | {
      type: 'group'
      key: string
      title: string
      icon: ReactNode
      children: SidebarChild[]
      requiredPermission?: AccountPermission
    }

export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    type: 'item',
    key: 'dashboard',
    title: '工作台',
    icon: <LayoutGrid className="w-4 h-4 text-primary" />,
    requiredPermission: 'dashboard:view'
  },
  {
    type: 'group',
    key: 'data-collection',
    title: '数据采集',
    icon: <Cpu className="w-4 h-4" />,
    children: [
      {
        key: 'amazon-collection',
        title: '亚马逊排行榜',
        icon: <Flame className="w-4 h-4 text-orange-500" />,
        requiredPermission: 'crawler:amazon'
      },
      {
        key: 'amazon-search',
        title: '亚马逊搜索词',
        icon: <Search className="w-4 h-4 text-sky-500" />,
        requiredPermission: 'crawler:amazon'
      }
    ]
  },
  {
    type: 'group',
    key: 'data-management',
    title: '数据管理',
    icon: <FileSpreadsheet className="w-4 h-4" />,
    children: [
      {
        key: 'data-browsing',
        title: '排行榜数据浏览',
        icon: <Database className="w-4 h-4 text-blue-500" />,
        requiredPermission: 'data:browse'
      },
      {
        key: 'search-keyword-browsing',
        title: '搜索词数据浏览',
        icon: <Search className="w-4 h-4 text-sky-500" />,
        requiredPermission: 'data:browse'
      },
      {
        key: 'data-deletion',
        title: '数据删除',
        icon: <Trash2 className="w-4 h-4 text-rose-500" />,
        requiredPermission: 'data:delete'
      }
    ]
  },
  {
    type: 'item',
    key: 'ai-functions',
    title: 'AI功能',
    icon: <Bot className="w-4 h-4 text-indigo-500" />,
    requiredPermission: 'ai:use'
  },
  {
    type: 'item',
    key: 'seller-sprite',
    title: '卖家精灵',
    icon: <Activity className="w-4 h-4 text-purple-500" />,
    requiredPermission: 'sellersprite:manage'
  },
  {
    type: 'item',
    key: 'settings',
    title: '设置',
    icon: <Settings className="w-4 h-4 text-slate-500" />,
    requiredPermission: 'settings:manage'
  }
]

export function canAccessTab(user: AccountUser | null, tab: TabKey): boolean {
  if (tab === 'account-admin') {
    return hasPermission(user, 'account:self')
  }

  for (const item of SIDEBAR_ITEMS) {
    if (item.type === 'item' && item.key === tab) {
      return !item.requiredPermission || hasPermission(user, item.requiredPermission)
    }

    if (item.type === 'group') {
      const child = item.children.find((candidate) => candidate.key === tab)
      if (child) {
        return !child.requiredPermission || hasPermission(user, child.requiredPermission)
      }
    }
  }

  return false
}

export function getAccessibleSidebarItems(user: AccountUser | null): SidebarItem[] {
  const items: SidebarItem[] = []

  SIDEBAR_ITEMS.forEach((item) => {
    if (item.type === 'item') {
      if (!item.requiredPermission || hasPermission(user, item.requiredPermission)) {
        items.push(item)
      }
      return
    }

    if (item.requiredPermission && !hasPermission(user, item.requiredPermission)) {
      return
    }

    const children = item.children.filter(
      (child) => !child.requiredPermission || hasPermission(user, child.requiredPermission)
    )

    if (children.length > 0) {
      items.push({ ...item, children })
    }
  })

  return items
}

export function getBreadcrumbs(activeTab: TabKey): string[] {
  if (activeTab === 'account-admin') {
    return ['账户与管理']
  }

  for (const item of SIDEBAR_ITEMS) {
    if (item.type === 'item' && item.key === activeTab) {
      return [item.title]
    }

    if (item.type === 'group') {
      const foundChild = item.children.find((child) => child.key === activeTab)
      if (foundChild) {
        return [item.title, foundChild.title]
      }
    }
  }

  return ['工作台']
}
