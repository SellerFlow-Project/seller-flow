import React, { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export const SplashView: React.FC = () => {
  const { setAuthenticatedUser, clearAuthenticatedUser } = useAppStore()
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('正在初始化系统内核...')

  useEffect(() => {
    // Progress bar animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev
        const next = prev + Math.floor(Math.random() * 15) + 5
        return next > 95 ? 95 : next
      })
    }, 180)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function bootstrap(): Promise<void> {
      setStatusText('正在校验本地登录会话与账号状态...')

      try {
        const result = await window.api.account.checkSession()

        if (cancelled) {
          return
        }

        setProgress(100)

        if (result.authenticated && result.user) {
          const authenticatedUser = result.user
          setStatusText('账号状态正常，正在进入 SellerFlow 工作台...')
          window.setTimeout(() => {
            if (!cancelled) {
              setAuthenticatedUser(authenticatedUser)
            }
          }, 450)
          return
        }

        setStatusText(result.reason || '登录会话无效，正在切换到登录界面...')
        window.setTimeout(() => {
          if (!cancelled) {
            clearAuthenticatedUser()
          }
        }, 650)
      } catch (error) {
        if (cancelled) {
          return
        }

        setProgress(100)
        setStatusText(
          error instanceof Error
            ? `账号服务校验失败：${error.message}`
            : '账号服务校验失败，正在切换到登录界面...'
        )
        window.setTimeout(() => {
          if (!cancelled) {
            clearAuthenticatedUser()
          }
        }, 900)
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [clearAuthenticatedUser, setAuthenticatedUser])

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-black font-sans text-foreground overflow-hidden select-none">
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(128,128,128,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Main Branding Card (No shadow, border/solid colors only) */}
      <div className="w-full max-w-md p-8 border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 flex flex-col items-center space-y-8 relative z-10">
        {/* Brand Logo Container */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-3xl tracking-wider select-none animate-pulse">
            S
          </div>
          <div className="text-center">
            <h1 className="font-extrabold text-2xl tracking-tight text-slate-800 dark:text-slate-100">
              SellerFlow
            </h1>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-0.5">
              跨境电商数据流选品
            </p>
          </div>
        </div>

        {/* Info Box (No shadow) */}
        {/*<div className="w-full bg-slate-50 dark:bg-zinc-900/40 border border-slate-100 dark:border-zinc-900 rounded-xl p-4 space-y-3">*/}
        {/*  <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-500 dark:text-zinc-400">*/}
        {/*    <Terminal className="w-3.5 h-3.5 text-primary" />*/}
        {/*    <span>BOOTSTRAP COMPONENT</span>*/}
        {/*  </div>*/}
        {/*  <div className="text-[11px] text-muted-foreground leading-relaxed">*/}
        {/*    基于底层 Electron 多线程递归树与卖家精灵并轨爬虫框架，保障本地运行环境的安全与隔离。*/}
        {/*  </div>*/}
        {/*</div>*/}

        {/* Loading Progress Center */}
        <div className="w-full space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">{statusText}</span>
            <span className="font-bold text-primary font-mono">{progress}%</span>
          </div>
          {/* Progress track */}
          <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Bottom Sparkle decoration */}
        <div className="flex items-center justify-center space-x-1.5 text-[10px] text-muted-foreground select-none">
          <Sparkles className="w-3 h-3 text-primary animate-pulse" />
          <span>V1.0.0 Stable Local Workstation</span>
        </div>
      </div>
    </div>
  )
}
