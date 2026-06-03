import { useEffect, useMemo } from 'react'
import { AppHeader } from './components/AppHeader'
import { AppSidebar } from './components/AppSidebar'
import { KeepAliveContainer } from './components/KeepAliveContainer'
import { UpdateDialog } from './components/UpdateDialog'
import { canAccessTab, getBreadcrumbs } from './config/navigation'
import { TAB_VIEWS } from './config/viewRegistry'
import { useAppStore } from './store/appStore'
import { useScreenAdaptation } from './hooks/useScreenAdaptation'
import { SplashView } from './views/SplashView'
import { LoginView } from './views/LoginView'
import { RegisterView } from './views/RegisterView'

function App(): React.JSX.Element {
  const {
    activeTab,
    expandedMenus,
    theme,
    authStage,
    currentUser,
    setTab,
    toggleMenu,
    toggleTheme,
    applyApplicationSettings
  } = useAppStore()
  const breadcrumbs = useMemo(() => getBreadcrumbs(activeTab), [activeTab])

  useScreenAdaptation()

  useEffect(() => {
    void window.api.settings
      .get()
      .then((settings) => applyApplicationSettings(settings.application))
      .catch((error) => console.error('[Settings] 加载应用程序设置失败：', error))
  }, [applyApplicationSettings])

  useEffect(() => {
    if (authStage === 'main' && !canAccessTab(currentUser, activeTab)) {
      setTab('dashboard')
    }
  }, [activeTab, authStage, currentUser, setTab])

  if (authStage === 'splash') {
    return <SplashView />
  }

  if (authStage === 'login') {
    return <LoginView />
  }

  if (authStage === 'register') {
    return <RegisterView />
  }

  return (
    <div className="flex w-screen h-screen bg-slate-50 dark:bg-black overflow-hidden font-sans select-none">
      <AppSidebar
        activeTab={activeTab}
        expandedMenus={expandedMenus}
        theme={theme}
        currentUser={currentUser}
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
