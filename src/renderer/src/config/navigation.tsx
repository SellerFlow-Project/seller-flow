import {
  Activity,
  Bot,
  Cpu,
  Database,
  FileSpreadsheet,
  Flame,
  LayoutGrid,
  Settings,
  Trash2
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { TabKey } from './tabs'

export interface SidebarChild {
  key: TabKey
  title: string
  icon: ReactNode
}

export type SidebarItem =
  | {
      type: 'item'
      key: TabKey
      title: string
      icon: ReactNode
    }
  | {
      type: 'group'
      key: string
      title: string
      icon: ReactNode
      children: SidebarChild[]
    }

export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    type: 'item',
    key: 'dashboard',
    title: '工作台',
    icon: <LayoutGrid className="w-4 h-4 text-primary" />
  },
  {
    type: 'group',
    key: 'data-collection',
    title: '数据采集',
    icon: <Cpu className="w-4 h-4" />,
    children: [
      {
        key: 'amazon-collection',
        title: '亚马逊采集',
        icon: <Flame className="w-4 h-4 text-orange-500" />
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
        title: '数据浏览',
        icon: <Database className="w-4 h-4 text-blue-500" />
      },
      {
        key: 'data-deletion',
        title: '数据删除',
        icon: <Trash2 className="w-4 h-4 text-rose-500" />
      }
    ]
  },
  {
    type: 'item',
    key: 'ai-functions',
    title: 'AI功能',
    icon: <Bot className="w-4 h-4 text-indigo-500" />
  },
  {
    type: 'item',
    key: 'seller-sprite',
    title: '卖家精灵',
    icon: <Activity className="w-4 h-4 text-purple-500" />
  },
  {
    type: 'item',
    key: 'settings',
    title: '设置',
    icon: <Settings className="w-4 h-4 text-slate-500" />
  }
]

export function getBreadcrumbs(activeTab: TabKey): string[] {
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
