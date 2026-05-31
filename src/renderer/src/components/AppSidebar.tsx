import React from 'react'
import { ChevronDown, ChevronRight, Laptop, Moon, Sun } from 'lucide-react'
import { SIDEBAR_ITEMS } from '../config/navigation'
import type { TabKey } from '../config/tabs'
import type { ThemeMode } from '../store/appStore'

interface AppSidebarProps {
  activeTab: TabKey
  expandedMenus: Record<string, boolean>
  theme: ThemeMode
  onSelectTab: (tab: TabKey) => void
  onToggleMenu: (menuKey: string) => void
  onToggleTheme: () => void
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  expandedMenus,
  theme,
  onSelectTab,
  onToggleMenu,
  onToggleTheme
}) => {
  return (
    <aside className="w-64 my-4 ml-4 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl flex flex-col justify-between flex-shrink-0 shadow-sm">
      <div className="flex flex-col overflow-y-auto">
        {/* Logo Section */}
        <div className="m-3 p-4 bg-slate-50/60 dark:bg-zinc-900/40 border border-slate-100/80 dark:border-zinc-800/60 rounded-xl flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-black text-lg tracking-wider">
            S
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-slate-800 dark:text-slate-100 leading-tight">
              SellerFlow
            </h1>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              跨境电商工作台
            </span>
          </div>
        </div>

        {/* Collapsible Menu Section */}
        <nav className="p-4 space-y-1.5">
          {SIDEBAR_ITEMS.map((item) => {
            if (item.type === 'group') {
              const isExpanded = expandedMenus[item.key]

              return (
                <div key={item.key} className="space-y-1">
                  {/* Expandable Parent Item */}
                  <button
                    onClick={() => onToggleMenu(item.key)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-md hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="text-slate-400 dark:text-zinc-500">{item.icon}</span>
                      <span>{item.title}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                    )}
                  </button>

                  {/* Children List */}
                  {isExpanded && (
                    <div className="pl-6 space-y-0.5 border-l border-slate-100 dark:border-zinc-900 ml-5 mt-0.5">
                      {item.children.map((child) => {
                        const isChildActive = activeTab === child.key

                        return (
                          <button
                            key={child.key}
                            onClick={() => onSelectTab(child.key)}
                            className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                              isChildActive
                                ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary font-semibold'
                                : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900/40'
                            }`}
                          >
                            <span className="flex-shrink-0">{child.icon}</span>
                            <span className="truncate">{child.title}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const isItemActive = activeTab === item.key

            return (
              <button
                key={item.key}
                onClick={() => onSelectTab(item.key)}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                  isItemActive
                    ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                    : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900/60'
                }`}
              >
                <span
                  className={isItemActive ? 'text-primary' : 'text-slate-400 dark:text-zinc-500'}
                >
                  {item.icon}
                </span>
                <span>{item.title}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Sidebar Footer Section */}
      <div className="m-3 p-4 bg-slate-50/60 dark:bg-zinc-900/40 border border-slate-100/80 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-xs text-slate-500">
            <Laptop className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 leading-tight">
              Admin
            </p>
            <span className="text-[9px] text-muted-foreground leading-none">本地调试端</span>
          </div>
        </div>
        <button
          onClick={onToggleTheme}
          className="p-1.5 border border-slate-200 dark:border-zinc-800 rounded bg-white hover:bg-slate-50 dark:bg-zinc-950 dark:hover:bg-zinc-900 text-slate-500 dark:text-zinc-400 transition-colors"
          title="切换主题"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>
    </aside>
  )
}
