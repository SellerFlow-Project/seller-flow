import { useEffect, useMemo } from 'react'
import { AppHeader } from './components/AppHeader'
import { AppSidebar } from './components/AppSidebar'
import { KeepAliveContainer } from './components/KeepAliveContainer'
import { UpdateDialog } from './components/UpdateDialog'
import { getBreadcrumbs } from './config/navigation'
import { TAB_VIEWS } from './config/viewRegistry'
import { useAppStore } from './store/appStore'
import { useScreenAdaptation } from './hooks/useScreenAdaptation'

function App(): React.JSX.Element {
  const { activeTab, expandedMenus, theme, setTab, toggleMenu, toggleTheme } = useAppStore()
  const breadcrumbs = useMemo(() => getBreadcrumbs(activeTab), [activeTab])

  useScreenAdaptation()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="flex w-screen h-screen bg-slate-50 dark:bg-black overflow-hidden font-sans select-none">
      <AppSidebar
        activeTab={activeTab}
        expandedMenus={expandedMenus}
        theme={theme}
        onSelectTab={setTab}
        onToggleMenu={toggleMenu}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-transparent text-foreground overflow-hidden">
        <AppHeader breadcrumbs={breadcrumbs} />

        {/* Persistent Content Render Area */}
        <div className="flex-1 min-h-0 bg-transparent relative overflow-hidden">
          <KeepAliveContainer activeTab={activeTab}>{TAB_VIEWS}</KeepAliveContainer>
        </div>
      </main>

      <UpdateDialog />
    </div>
  )
}

export default App
