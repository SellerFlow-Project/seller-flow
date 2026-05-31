import React from 'react'

interface AppHeaderProps {
  breadcrumbs: string[]
}

export const AppHeader: React.FC<AppHeaderProps> = ({ breadcrumbs }) => {
  return (
    <header className="h-14 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between px-6 flex-shrink-0 shadow-sm mt-4 mr-4 ml-4">
      {/* Breadcrumb Info */}
      <div className="flex items-center space-x-2 text-xs font-semibold">
        <span className="text-muted-foreground hover:text-slate-700 transition-colors">
          SellerFlow
        </span>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            <span className="text-slate-300 dark:text-zinc-700">/</span>
            <span
              className={
                idx === breadcrumbs.length - 1
                  ? 'text-primary'
                  : 'text-slate-600 dark:text-zinc-400'
              }
            >
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Quick Stats Panel */}
      <div className="flex items-center space-x-4">
        <div className="inline-flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            核心主线程运行中
          </span>
        </div>
      </div>
    </header>
  )
}
