import React, { useState } from 'react'
import { Laptop, Lock, User, AlertCircle, Info } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export const LoginView: React.FC = () => {
  const { setAuthStage, setAuthenticatedUser } = useAppStore()
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [deviceName, setDeviceName] = useState('SellerFlow Mac App')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErrorMsg('')

    if (!loginName.trim()) {
      setErrorMsg('请输入登录用户名！')
      return
    }

    if (!password) {
      setErrorMsg('请输入登录密码！')
      return
    }

    if (deviceName.length > 100) {
      setErrorMsg('设备名称不能超过 100 个字符')
      return
    }

    setIsSubmitting(true)
    try {
      const session = await window.api.account.login({
        login_name: loginName.trim(),
        password,
        device_name: deviceName.trim() || undefined
      })
      setAuthenticatedUser(session.user)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '登录失败，请稍后重试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-black font-sans text-foreground overflow-hidden select-none">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(128,128,128,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Main card (No shadows, borders only) */}
      <div className="w-full max-w-md p-8 border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 flex flex-col space-y-6 relative z-10">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center space-y-1.5">
          <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-white font-extrabold text-xl">
            S
          </div>
          <div>
            <h1 className="font-extrabold text-xl text-slate-800 dark:text-slate-100">
              欢迎返回 SellerFlow
            </h1>
            <p className="text-[11px] text-muted-foreground">请输入您的账户凭证以登录工作台</p>
          </div>
        </div>

        {/* Error notification banner */}
        {errorMsg && (
          <div className="flex items-start space-x-2.5 p-3 rounded-lg border border-rose-200 dark:border-rose-950 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>用户名 / 登录名</span>
            </label>
            <input
              type="text"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              placeholder="请输入登录账号"
              className="w-full bg-background border border-slate-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
            />
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>登录密码</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full bg-background border border-slate-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
            />
          </div>

          {/* Optional Device Name Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5" />
              <span>当前设备名称 (可选)</span>
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="例如: Windows"
              className="w-full bg-background border border-slate-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:bg-primary/95 transition-all text-xs hover:-translate-y-[1px] active:translate-y-0 cursor-pointer"
          >
            {isSubmitting ? '正在登录...' : '立即登录'}
          </button>
        </form>

        {/* Footer actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-zinc-900 flex items-center justify-between text-xs">
          <button
            onClick={() => setAuthStage('register')}
            className="text-primary font-bold hover:underline"
          >
            注册新账号
          </button>

          <div className="flex items-center space-x-1 text-[10px] text-muted-foreground">
            <Info className="w-3 h-3 text-slate-400" />
            <span>支持本地沙盒数据保护</span>
          </div>
        </div>
      </div>
    </div>
  )
}
