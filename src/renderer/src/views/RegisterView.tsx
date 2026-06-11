import React, { useState } from 'react'
import { KeyRound, Laptop, Lock, User, AlertCircle, Sparkles } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export const RegisterView: React.FC = () => {
  const { setAuthStage, setAuthenticatedUser } = useAppStore()
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [deviceName, setDeviceName] = useState('SellerFlow Mac App')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRegister = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErrorMsg('')

    if (!loginName.trim()) {
      setErrorMsg('请输入用户名！')
      return
    }

    // Pattern matching validation: ^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$
    const loginNameRegex = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/
    if (!loginNameRegex.test(loginName)) {
      setErrorMsg(
        '用户名必须以字母或数字开头，长度在 3 到 64 之间，且仅包含字母、数字、点(.)、下划线(_)或横线(-)。'
      )
      return
    }

    if (!password) {
      setErrorMsg('请输入注册密码！')
      return
    }

    if (password.length < 6 || password.length > 128) {
      setErrorMsg(`密码长度不符合规范（当前长度: ${password.length}，要求 6-128 位之间）。`)
      return
    }

    if (!registrationCode.trim()) {
      setErrorMsg('请输入激活注册码！')
      return
    }

    if (deviceName.length > 100) {
      setErrorMsg('设备名称不能超过 100 个字符')
      return
    }

    setIsSubmitting(true)
    try {
      const session = await window.api.account.register({
        login_name: loginName.trim(),
        password,
        registration_code: registrationCode.trim(),
        device_name: deviceName.trim() || undefined
      })
      setAuthenticatedUser(session.user)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '注册失败，请检查注册码后重试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-black font-sans text-foreground overflow-hidden select-none">
      {/* Background grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(128,128,128,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Main registration card (No shadows, borders only) */}
      <div className="w-full max-w-md p-8 border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 flex flex-col space-y-5 relative z-10">
        {/* Logo header */}
        <div className="flex flex-col items-center text-center space-y-1">
          <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-white font-extrabold text-xl">
            S
          </div>
          <div>
            <h1 className="font-extrabold text-xl text-slate-800 dark:text-slate-100">
              注册新用户账号
            </h1>
            <p className="text-[11px] text-muted-foreground">请输入以下注册信息以获取工作台权限</p>
          </div>
        </div>

        {/* Error panel banner */}
        {errorMsg && (
          <div className="flex items-start space-x-2 p-3 rounded-lg border border-rose-200 dark:border-rose-950 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-3.5">
          {/* Username registration field */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>用户名 (字母/数字/点/下划线/中划线)</span>
            </label>
            <input
              type="text"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              placeholder="以字母或数字开头，长度在 3-64"
              className="w-full bg-background border border-slate-200 dark:border-zinc-800 rounded-lg px-3.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
            />
          </div>

          {/* Password registration field */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>注册密码</span>
              </label>
              <span
                className={`text-[9px] font-semibold ${password.length >= 6 ? 'text-emerald-500' : 'text-rose-500'}`}
              >
                当前长度: {password.length} (要求 ≥ 6)
              </span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入安全密码（不低于 6 位）"
              className="w-full bg-background border border-slate-200 dark:border-zinc-800 rounded-lg px-3.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
            />
          </div>

          {/* Registration Code registration field */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              <span>注册激活码</span>
            </label>
            <input
              type="text"
              value={registrationCode}
              onChange={(e) => setRegistrationCode(e.target.value)}
              placeholder="请输入有效的邀请或激活码"
              className="w-full bg-background border border-slate-200 dark:border-zinc-800 rounded-lg px-3.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
            />
          </div>

          {/* Optional device name registration field */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5" />
              <span>当前设备绑定名称 (可选)</span>
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="请输入绑定此账号的设备别名"
              className="w-full bg-background border border-slate-200 dark:border-zinc-800 rounded-lg px-3.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:bg-primary/95 transition-all text-xs hover:-translate-y-[1px] active:translate-y-0 cursor-pointer"
          >
            {isSubmitting ? '正在注册...' : '立即注册并登录'}
          </button>
        </form>

        {/* Form bottom switcher links */}
        <div className="pt-3.5 border-t border-slate-100 dark:border-zinc-900 flex items-center justify-between text-xs">
          <button
            onClick={() => setAuthStage('login')}
            className="text-primary font-bold hover:underline"
          >
            返回已有账号登录
          </button>

          <div className="flex items-center space-x-1 text-[10px] text-muted-foreground">
            <Sparkles className="w-3 h-3 text-primary animate-pulse" />
            <span>获取本地独立凭证</span>
          </div>
        </div>
      </div>
    </div>
  )
}
