import React, { useEffect, useMemo, useState } from 'react'
import {
  User,
  KeyRound,
  ShieldAlert,
  History,
  Lock,
  LogOut,
  CheckCircle,
  AlertTriangle,
  Plus,
  Ban,
  Check,
  Search,
  Eye,
  RefreshCw,
  Clock
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import type { AccountRole, AccountUser, AuditLog, RegistrationCode } from '../../../shared/account'

const ACCOUNT_ROLE_LABELS: Record<AccountRole, string> = {
  user: '试用账号',
  staff: '运营人员',
  admin: '管理员',
  super_admin: '超级管理员'
}

function getRoleLabel(role: AccountRole): string {
  return ACCOUNT_ROLE_LABELS[role] || role
}

function formatAccountDateTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

export const AccountAdminView: React.FC = () => {
  const { currentUser, setAuthenticatedUser, clearAuthenticatedUser, hasPermission } = useAppStore()

  // View Section navigation State
  const [activeSection, setActiveSection] = useState<'profile' | 'codes' | 'users' | 'logs'>(
    'profile'
  )

  const canManageCodes = hasPermission('admin:registration_codes')
  const canManageUsers = hasPermission('admin:users')
  const canViewAuditLogs = hasPermission('admin:audit_logs')

  // Current Logged in User Profile (/me)
  const [myProfile, setMyProfile] = useState<AccountUser | null>(currentUser)
  const [pageError, setPageError] = useState('')
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)

  // Change password (/me/password) Form State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwError, setPwError] = useState('')

  // Registration Codes (/admin/registration-codes)
  const [registrationCodes, setRegistrationCodes] = useState<RegistrationCode[]>([])

  // New Code Form State
  const [newCodeMaxUses, setNewCodeMaxUses] = useState(1)
  const [newCodeExpiresAt, setNewCodeExpiresAt] = useState('')
  const [newCodeNoExpiry, setNewCodeNoExpiry] = useState(true)
  const [createdCodeInfo, setCreatedCodeInfo] = useState('')

  // Managed Users (/admin/users)
  const [managedUsers, setManagedUsers] = useState<AccountUser[]>([])

  // User Editing Roles State Overlay
  const [editingUser, setEditingUser] = useState<AccountUser | null>(null)
  const [editRolesList, setEditRolesList] = useState<AccountRole[]>([])

  // Audit Logs (/admin/audit-logs)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [logSearchQuery, setLogSearchQuery] = useState('')
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)
  const [isLoadingAdminData, setIsLoadingAdminData] = useState(false)
  const [adminError, setAdminError] = useState('')
  const effectiveSection =
    (activeSection === 'codes' && !canManageCodes) ||
    (activeSection === 'users' && !canManageUsers) ||
    (activeSection === 'logs' && !canViewAuditLogs)
      ? 'profile'
      : activeSection

  useEffect(() => {
    let cancelled = false

    async function loadProfile(): Promise<void> {
      setIsLoadingProfile(true)
      setPageError('')

      try {
        const user = await window.api.account.getCurrentUser()
        if (!cancelled) {
          setMyProfile(user)
          setAuthenticatedUser(user)
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : '读取当前账号信息失败。')
          clearAuthenticatedUser()
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false)
        }
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [clearAuthenticatedUser, setAuthenticatedUser])

  useEffect(() => {
    let cancelled = false

    async function loadAdminData(): Promise<void> {
      setIsLoadingAdminData(true)
      setAdminError('')

      try {
        if (effectiveSection === 'codes' && canManageCodes) {
          const codes = await window.api.account.listRegistrationCodes()
          if (!cancelled) setRegistrationCodes(codes)
        }

        if (effectiveSection === 'users' && canManageUsers) {
          const users = await window.api.account.listUsers()
          if (!cancelled) setManagedUsers(users)
        }

        if (effectiveSection === 'logs' && canViewAuditLogs) {
          const logs = await window.api.account.listAuditLogs()
          if (!cancelled) setAuditLogs(logs)
        }
      } catch (error) {
        if (!cancelled) {
          setAdminError(error instanceof Error ? error.message : '读取管理数据失败。')
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAdminData(false)
        }
      }
    }

    void loadAdminData()

    return () => {
      cancelled = true
    }
  }, [effectiveSection, canManageCodes, canManageUsers, canViewAuditLogs])

  // 1. Password change Logic (/me/password)
  const handleChangePassword = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setPwError('')
    setPwSuccess('')

    if (!currentPassword) {
      setPwError('请输入当前旧密码')
      return
    }

    if (newPassword.length < 6 || newPassword.length > 128) {
      setPwError(`新密码长度不符（当前: ${newPassword.length} 位，应在 6-128 位之间）`)
      return
    }

    if (newPassword !== confirmPassword) {
      setPwError('新密码与确认密码输入不一致')
      return
    }

    try {
      await window.api.account.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      })
      setPwSuccess('密码更新成功，其它设备的登录会话均已强制注销失效。')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPwError(error instanceof Error ? error.message : '密码更新失败。')
    }
  }

  // 2. Logout Action Logic (/auth/logout, /auth/logout-all)
  const handleLogout = async (allDevices: boolean): Promise<void> => {
    const confirmation = window.confirm(
      allDevices
        ? '确定要注销并清除当前用户在所有设备上的登录状态吗？'
        : '确定退出登录当前工作台吗？'
    )
    if (!confirmation) return

    try {
      await window.api.account.logout(allDevices)
    } finally {
      clearAuthenticatedUser()
    }
  }

  // 3. Create Registration Code Logic (POST /admin/registration-codes)
  const handleCreateCode = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setCreatedCodeInfo('')
    setAdminError('')

    if (newCodeMaxUses < 1 || newCodeMaxUses > 10000) {
      alert('最大使用次数必须在 1 至 10000 之间')
      return
    }

    try {
      const result = await window.api.account.createRegistrationCode({
        max_uses: newCodeMaxUses,
        expires_at: newCodeNoExpiry
          ? null
          : newCodeExpiresAt
            ? new Date(newCodeExpiresAt).toISOString()
            : null
      })

      setRegistrationCodes((prev) => [result.registration_code, ...prev])
      setCreatedCodeInfo(result.code)
      if (canViewAuditLogs) {
        setAuditLogs(await window.api.account.listAuditLogs())
      }
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : '创建注册码失败。')
    }
  }

  // 4. Revoke Registration Code Logic (POST /admin/registration-codes/{id}/revoke)
  const handleRevokeCode = async (codeId: string, codeString: string): Promise<void> => {
    if (!window.confirm(`确定要撤销激活码 [${codeString}] 吗？撤销后将不可再次用于注册！`)) return

    try {
      await window.api.account.revokeRegistrationCode(codeId)
      setRegistrationCodes((prev) =>
        prev.map((c) => (c.id === codeId ? { ...c, status: 'revoked' } : c))
      )
      if (canViewAuditLogs) {
        setAuditLogs(await window.api.account.listAuditLogs())
      }
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : '废除注册码失败。')
    }
  }

  // 5. Enable/Disable User Action (PATCH /admin/users/{id}/status)
  const handleToggleUserStatus = async (
    userId: string,
    userName: string,
    currentStatus: 'active' | 'disabled'
  ): Promise<void> => {
    const nextStatus = currentStatus === 'active' ? 'disabled' : 'active'
    if (
      !window.confirm(
        `确定要将用户 [${userName}] 的状态变更为 [${nextStatus === 'active' ? '启用' : '禁用'}] 吗？`
      )
    )
      return

    try {
      await window.api.account.updateUserStatus(userId, nextStatus)
      setManagedUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, status: nextStatus, updated_at: new Date().toISOString() } : u
        )
      )
      if (canViewAuditLogs) {
        setAuditLogs(await window.api.account.listAuditLogs())
      }
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : '更新用户状态失败。')
    }
  }

  // 6. Replace User Roles Action (PUT /admin/users/{id}/roles)
  const handleSaveUserRoles = async (): Promise<void> => {
    if (!editingUser) return
    if (editRolesList.length === 0) {
      alert('用户必须至少拥有一个角色权限！')
      return
    }

    try {
      await window.api.account.updateUserRoles(editingUser.id, editRolesList)
      setManagedUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, roles: editRolesList, updated_at: new Date().toISOString() }
            : u
        )
      )
      setEditingUser(null)
      if (canViewAuditLogs) {
        setAuditLogs(await window.api.account.listAuditLogs())
      }
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : '保存用户角色失败。')
    }
  }

  // 7. Revoke User Sessions Action (POST /admin/users/{id}/sessions/revoke)
  const handleRevokeUserSessions = async (userId: string, userName: string): Promise<void> => {
    if (
      !window.confirm(
        `【警告】确定要强制清除用户 [${userName}] 的所有登录会话吗？该用户在所有客户端将立即掉线。`
      )
    )
      return

    try {
      await window.api.account.revokeUserSessions(userId)
      if (canViewAuditLogs) {
        setAuditLogs(await window.api.account.listAuditLogs())
      }
      alert(`已成功发送注销指令，强制清除用户 [${userName}] 的所有登录态凭证。`)
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : '强退用户会话失败。')
    }
  }

  // Filter audit logs based on search query
  const filteredLogs = useMemo(
    () =>
      auditLogs.filter((log) => {
        const query = logSearchQuery.toLowerCase().trim()
        if (!query) return true
        return (
          log.action.toLowerCase().includes(query) ||
          log.target_type.toLowerCase().includes(query) ||
          (log.actor_user_id && log.actor_user_id.toLowerCase().includes(query)) ||
          log.target_id.toLowerCase().includes(query)
        )
      }),
    [auditLogs, logSearchQuery]
  )

  const profile = myProfile

  if (!profile) {
    return (
      <div className="p-6 h-full bg-slate-50 dark:bg-black font-sans text-foreground">
        <div className="bg-card text-card-foreground border border-border rounded-lg p-6">
          <h3 className="text-base font-bold text-foreground">账户与管理中心</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isLoadingProfile
              ? '正在读取当前登录账户信息...'
              : pageError || '当前未登录，请重新登录。'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-black font-sans text-foreground">
      {/* Settings Grid canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1 min-h-0">
        {/* Left Side: Nested sub navigation (lg:col-span-3) */}
        <div className="lg:col-span-3 bg-card text-card-foreground border border-border rounded-lg p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 px-3 pb-3 mb-3 border-b border-border">
              <ShieldAlert className="w-4 h-4 text-primary" />
              <h2 className="font-bold text-sm">账户与管理中心</h2>
            </div>

            {/* Nav Menu tabs */}
            <button
              onClick={() => setActiveSection('profile')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
                effectiveSection === 'profile'
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100/50 dark:hover:bg-zinc-900/40'
              }`}
            >
              <User className="w-4 h-4" />
              <span>个人中心</span>
            </button>

            {canManageCodes && (
              <button
                onClick={() => setActiveSection('codes')}
                className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
                  effectiveSection === 'codes'
                    ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                    : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100/50 dark:hover:bg-zinc-900/40'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>注册激活码管理</span>
              </button>
            )}

            {canManageUsers && (
              <button
                onClick={() => setActiveSection('users')}
                className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
                  effectiveSection === 'users'
                    ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                    : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100/50 dark:hover:bg-zinc-900/40'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>用户管理</span>
              </button>
            )}

            {canViewAuditLogs && (
              <button
                onClick={() => setActiveSection('logs')}
                className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
                  effectiveSection === 'logs'
                    ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                    : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100/50 dark:hover:bg-zinc-900/40'
                }`}
              >
                <History className="w-4 h-4" />
                <span>系统审计日志</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Active view content (lg:col-span-9) */}
        <div className="lg:col-span-9 bg-card text-card-foreground border border-border rounded-lg p-6 flex flex-col justify-between min-h-[460px] min-w-0">
          <div className="flex-1 min-h-0 min-w-0">
            {adminError && (
              <div className="mb-4 flex items-start space-x-2.5 p-3 rounded-lg border border-rose-200 dark:border-rose-950 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-semibold">{adminError}</span>
              </div>
            )}

            {/* 1. PERSONAL PROFILE SECTION */}
            {effectiveSection === 'profile' && (
              <div className="space-y-6 flex flex-col min-h-0">
                <div className="pb-4 border-b border-border shrink-0">
                  <h3 className="text-base font-bold text-foreground">个人账户中心</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    查看当前登录账户的信息属性，或更改您的安全登录密码
                  </p>
                </div>

                {/* Profile detail card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-zinc-900/20 border border-border/80 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      账户基本属性
                    </h4>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-border/50 pb-1.5">
                        <span className="text-muted-foreground">用户标识 (ID):</span>
                        <span className="font-mono font-bold text-[10px] text-slate-800 dark:text-zinc-300">
                          {profile.id}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-1.5">
                        <span className="text-muted-foreground">登录名称:</span>
                        <span className="font-bold text-primary">{profile.login_name}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-1.5">
                        <span className="text-muted-foreground">账户状态:</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                          {profile.status === 'active' ? '正常激活' : '禁用'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-1.5">
                        <span className="text-muted-foreground">拥有的角色:</span>
                        <div className="flex gap-1">
                          {profile.roles.map((r) => (
                            <span
                              key={r}
                              className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded text-[9px] font-bold"
                              title={r}
                            >
                              {getRoleLabel(r)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-1.5">
                        <span className="text-muted-foreground">创建时间:</span>
                        <span className="font-mono text-muted-foreground text-[10px]">
                          {formatAccountDateTime(profile.created_at)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">最近更新:</span>
                        <span className="font-mono text-muted-foreground text-[10px]">
                          {formatAccountDateTime(profile.updated_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Logouts Section */}
                  <div className="bg-slate-50 dark:bg-zinc-900/20 border border-border/80 rounded-xl p-4 flex flex-col justify-between space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">
                        会话安全操作
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        支持快捷注销退出登录状态，或执行高危的「全设备强制离线」，以废弃所有已分发的
                        session tokens。
                      </p>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={() => handleLogout(false)}
                        className="w-full inline-flex items-center justify-center space-x-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold py-2 rounded-md transition-colors text-xs"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>退出当前登录会话</span>
                      </button>
                      <button
                        onClick={() => handleLogout(true)}
                        className="w-full inline-flex items-center justify-center space-x-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold py-2 rounded-md transition-colors text-xs"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>注销所有设备会话</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Change Form */}
                <div className="bg-slate-50 dark:bg-zinc-900/20 border border-border/80 rounded-xl p-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-primary" />
                    <span>更新安全密码</span>
                  </h4>

                  {pwSuccess && (
                    <div className="flex items-start space-x-2.5 p-3 rounded-lg border border-emerald-200 dark:border-emerald-950 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-xs">
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="font-semibold">{pwSuccess}</span>
                    </div>
                  )}

                  {pwError && (
                    <div className="flex items-start space-x-2.5 p-3 rounded-lg border border-rose-200 dark:border-rose-950 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="font-semibold">{pwError}</span>
                    </div>
                  )}

                  <form
                    onSubmit={handleChangePassword}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
                  >
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        当前旧密码
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="请输入旧密码"
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        新密码 (不低于6位)
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="请输入新密码"
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        确认新密码
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="再次输入新密码"
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                      />
                    </div>

                    <div className="md:col-span-3 flex justify-end pt-2">
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center space-x-2 bg-primary text-primary-foreground font-semibold px-5 py-2 rounded-md hover:bg-primary/95 transition-all text-xs"
                      >
                        <Check className="w-4 h-4" />
                        <span>确认更改密码</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 2. REGISTRATION CODE MANAGEMENT */}
            {effectiveSection === 'codes' && canManageCodes && (
              <div className="space-y-6">
                <div className="pb-4 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">注册激活码管理</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    为新的客户端发放和废除系统注册凭证
                  </p>
                </div>

                {/* Create Code Area */}
                <div className="bg-slate-50 dark:bg-zinc-900/20 border border-border/80 rounded-xl p-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-primary" />
                    <span>创建新注册码</span>
                  </h4>

                  {createdCodeInfo && (
                    <div className="flex flex-col space-y-2 p-4 rounded-lg border border-emerald-200 dark:border-emerald-950 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span className="font-bold">
                          激活码创建成功（明文仅返回一次，请妥善复制保存）：
                        </span>
                      </div>
                      <div className="text-base font-black tracking-widest bg-white dark:bg-zinc-900 p-2 border border-emerald-100 dark:border-zinc-800 rounded select-all text-center">
                        {createdCodeInfo}
                      </div>
                    </div>
                  )}

                  <form
                    onSubmit={handleCreateCode}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
                  >
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        最大使用次数
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={newCodeMaxUses}
                        onChange={(e) => setNewCodeMaxUses(Number(e.target.value))}
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-semibold text-muted-foreground">
                          过期日期
                        </label>
                        <label className="text-[10px] text-muted-foreground flex items-center gap-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newCodeNoExpiry}
                            onChange={(e) => setNewCodeNoExpiry(e.target.checked)}
                          />
                          <span>永久不过期</span>
                        </label>
                      </div>
                      <input
                        type="datetime-local"
                        value={newCodeExpiresAt}
                        disabled={newCodeNoExpiry}
                        onChange={(e) => setNewCodeExpiresAt(e.target.value)}
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center space-x-1.5 bg-primary text-primary-foreground font-semibold py-2 rounded-md hover:bg-primary/95 transition-all text-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>生成激活码</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Codes Table List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    注册码批次列表
                  </h4>
                  <div className="border border-border/80 rounded-xl overflow-hidden bg-slate-50/30 dark:bg-zinc-950/20">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/50 dark:bg-zinc-900/60 border-b border-border text-slate-500 font-semibold select-none">
                          <th className="py-2.5 px-4 font-bold uppercase tracking-wider">
                            注册码 ID
                          </th>
                          <th className="py-2.5 px-4 font-bold">激活码状态</th>
                          <th className="py-2.5 px-4 font-bold text-center">
                            可注册数 (已使用 / 总数)
                          </th>
                          <th className="py-2.5 px-4 font-bold text-center">创建人</th>
                          <th className="py-2.5 px-4 font-bold text-center">过期时间</th>
                          <th className="py-2.5 px-4 font-bold text-center">创建时间</th>
                          <th className="py-2.5 px-4 font-bold text-center w-20">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {isLoadingAdminData && registrationCodes.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="py-8 text-center text-muted-foreground font-semibold"
                            >
                              正在读取注册码列表...
                            </td>
                          </tr>
                        ) : registrationCodes.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="py-8 text-center text-muted-foreground font-semibold"
                            >
                              暂无注册码数据。
                            </td>
                          </tr>
                        ) : (
                          registrationCodes.map((code) => {
                            const codeLabel = code.code || code.hint
                            return (
                              <tr
                                key={code.id}
                                className="hover:bg-slate-100/20 dark:hover:bg-zinc-900/20 transition-all"
                              >
                                <td className="py-3 px-4 font-mono font-bold">
                                  <span className="text-slate-800 dark:text-zinc-200">
                                    {codeLabel}
                                  </span>
                                  <span className="block text-[9px] text-muted-foreground font-medium">
                                    {code.id}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  {code.status === 'active' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                                      可用
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/25">
                                      已废除
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center font-mono font-bold text-slate-700 dark:text-zinc-300">
                                  {code.used_count}{' '}
                                  <span className="text-muted-foreground font-normal">/</span>{' '}
                                  {code.max_uses}
                                </td>
                                <td className="py-3 px-4 text-center font-mono text-[9px] text-slate-500">
                                  {code.created_by.substring(0, 8)}...
                                </td>
                                <td className="py-3 px-4 text-center font-mono text-[10px] text-slate-500">
                                  {code.expires_at
                                    ? new Date(code.expires_at).toLocaleString()
                                    : '永久有效'}
                                </td>
                                <td className="py-3 px-4 text-center font-mono text-[10px] text-slate-500">
                                  {new Date(code.created_at).toLocaleString()}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    onClick={() => void handleRevokeCode(code.id, codeLabel)}
                                    disabled={code.status === 'revoked'}
                                    className="p-1.5 rounded border border-border bg-background hover:bg-rose-500/10 hover:border-rose-500/40 text-muted-foreground hover:text-rose-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="废除激活码"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 3. USER MANAGEMENT */}
            {effectiveSection === 'users' && canManageUsers && (
              <div className="space-y-6">
                <div className="pb-4 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">用户权限管理</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    管理系统内注册用户的登录权限、角色职责分配以及会话状态
                  </p>
                </div>

                {/* Edit Roles Dialog Box (Flat inline modal) */}
                {editingUser && (
                  <div className="bg-slate-50 dark:bg-zinc-900/30 border border-primary/25 rounded-xl p-5 space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-primary" />
                        <span>修改用户角色: {editingUser.login_name}</span>
                      </h4>
                      <button
                        onClick={() => setEditingUser(null)}
                        className="text-xs text-muted-foreground hover:text-foreground font-semibold"
                      >
                        取消
                      </button>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        请勾选为该用户赋予的角色身份权限。可多选，修改后将自动同步至用户的权限：
                      </p>

                      <div className="flex flex-wrap gap-4 text-xs">
                        {(['user', 'staff', 'admin', 'super_admin'] as AccountRole[]).map(
                          (role) => {
                            const checked = editRolesList.includes(role)
                            return (
                              <label
                                key={role}
                                className="flex items-center space-x-1.5 cursor-pointer font-semibold select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    if (checked) {
                                      setEditRolesList((prev) => prev.filter((r) => r !== role))
                                    } else {
                                      setEditRolesList((prev) => [...prev, role])
                                    }
                                  }}
                                />
                                <span className="text-[10px] tracking-wide font-bold" title={role}>
                                  {getRoleLabel(role)}
                                </span>
                              </label>
                            )
                          }
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleSaveUserRoles}
                        className="inline-flex items-center justify-center space-x-1 bg-primary text-primary-foreground font-semibold px-4 py-1.5 rounded-md hover:bg-primary/95 transition-all text-xs"
                      >
                        <Check className="w-4 h-4" />
                        <span>保存角色配置</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Users List Table */}
                <div className="border border-border/80 rounded-xl overflow-hidden bg-slate-50/30 dark:bg-zinc-950/20">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/50 dark:bg-zinc-900/60 border-b border-border text-slate-500 font-semibold select-none">
                        <th className="py-2.5 px-4 font-bold uppercase tracking-wider">
                          用户登录名 (ID)
                        </th>
                        <th className="py-2.5 px-4 font-bold">状态</th>
                        <th className="py-2.5 px-4 font-bold">角色分配</th>
                        <th className="py-2.5 px-4 font-bold text-center">创建日期</th>
                        <th className="py-2.5 px-4 font-bold text-center">最近更新</th>
                        <th className="py-2.5 px-4 font-bold text-center w-36">快捷操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {isLoadingAdminData && managedUsers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-muted-foreground font-semibold"
                          >
                            正在读取用户列表...
                          </td>
                        </tr>
                      ) : managedUsers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-muted-foreground font-semibold"
                          >
                            暂无用户数据。
                          </td>
                        </tr>
                      ) : (
                        managedUsers.map((user) => (
                          <tr
                            key={user.id}
                            className="hover:bg-slate-100/20 dark:hover:bg-zinc-900/20 transition-all"
                          >
                            <td className="py-3.5 px-4 font-mono font-bold">
                              <span className="text-slate-800 dark:text-zinc-200 text-sm">
                                {user.login_name}
                              </span>
                              <span className="block text-[9px] text-muted-foreground font-medium">
                                {user.id}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              {user.status === 'active' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                                  启用中
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/25">
                                  已禁用
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap gap-1">
                                {user.roles.map((role) => (
                                  <span
                                    key={role}
                                    className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded text-[9px] font-bold"
                                    title={role}
                                  >
                                    {getRoleLabel(role)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono text-[10px] text-slate-500">
                              {new Date(user.created_at).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono text-[10px] text-slate-500">
                              {new Date(user.updated_at).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Status Edit */}
                                <button
                                  onClick={() =>
                                    handleToggleUserStatus(user.id, user.login_name, user.status)
                                  }
                                  className={`p-1.5 rounded border transition-colors ${
                                    user.status === 'active'
                                      ? 'border-border bg-background hover:bg-rose-500/10 hover:border-rose-500/30 text-rose-500'
                                      : 'border-border bg-background hover:bg-emerald-500/10 hover:border-emerald-500/30 text-emerald-500'
                                  }`}
                                  title={user.status === 'active' ? '禁用用户' : '启用用户'}
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>

                                {/* Roles edit */}
                                <button
                                  onClick={() => {
                                    setEditingUser(user)
                                    setEditRolesList([...user.roles])
                                  }}
                                  className="p-1.5 rounded border border-border bg-background hover:bg-indigo-500/10 hover:border-indigo-500/30 text-indigo-500 transition-colors"
                                  title="配置用户权限"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                </button>

                                {/* Kill sessions */}
                                <button
                                  onClick={() => handleRevokeUserSessions(user.id, user.login_name)}
                                  className="p-1.5 rounded border border-border bg-background hover:bg-rose-600 hover:text-white hover:border-rose-600 text-muted-foreground transition-colors"
                                  title="强退所有会话"
                                >
                                  <LogOut className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. AUDIT LOGS */}
            {effectiveSection === 'logs' && canViewAuditLogs && (
              <div className="space-y-6">
                <div className="pb-4 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">系统审计日志</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    查看由系统事件、管理员及沙盒任务触发的安全与业务操作追溯明细
                  </p>
                </div>

                {/* Filter and stats bars */}
                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between shrink-0">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="搜索操作行为、目标类型、ID 关键字..."
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div className="flex items-center gap-3 text-xs shrink-0 select-none">
                    <div className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-bold">
                      展示数: {filteredLogs.length} 条
                    </div>
                    <button
                      onClick={() => setLogSearchQuery('')}
                      className="p-1.5 rounded border border-border bg-background hover:bg-slate-100 dark:hover:bg-zinc-800 text-muted-foreground transition-colors"
                      title="重置过滤"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Log trail list */}
                <div className="relative border border-border/80 rounded-xl overflow-auto bg-slate-50/30 dark:bg-zinc-950/20 max-h-[calc(100vh-360px)] min-h-0 isolate">
                  <table className="w-full min-w-[920px] text-left border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-zinc-900">
                      <tr className="border-b border-border text-slate-500 font-semibold select-none">
                        <th className="py-2.5 px-4 font-bold uppercase tracking-wider w-20 bg-slate-100 dark:bg-zinc-900">
                          事件 ID
                        </th>
                        <th className="py-2.5 px-4 font-bold bg-slate-100 dark:bg-zinc-900">
                          操作名称
                        </th>
                        <th className="py-2.5 px-4 font-bold bg-slate-100 dark:bg-zinc-900">
                          目标对象类型
                        </th>
                        <th className="py-2.5 px-4 font-bold bg-slate-100 dark:bg-zinc-900">
                          关联目标 ID
                        </th>
                        <th className="py-2.5 px-4 font-bold text-center bg-slate-100 dark:bg-zinc-900">
                          操作人 ID
                        </th>
                        <th className="py-2.5 px-4 font-bold text-center bg-slate-100 dark:bg-zinc-900">
                          发生时间
                        </th>
                        <th className="py-2.5 px-4 font-bold text-center w-16 bg-slate-100 dark:bg-zinc-900">
                          详情
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center text-muted-foreground font-semibold"
                          >
                            未匹配到符合过滤条件的审计日志。
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => {
                          const isExpanded = expandedLogId === log.id
                          return (
                            <React.Fragment key={log.id}>
                              <tr className="hover:bg-slate-100/20 dark:hover:bg-zinc-900/20 transition-all">
                                <td className="py-3 px-4 font-mono font-bold text-slate-500">
                                  {log.id}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="font-mono text-primary font-bold">
                                    {log.action}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-600 dark:text-zinc-400">
                                  {log.target_type}
                                </td>
                                <td className="py-3 px-4 font-mono text-[10px] text-slate-500 break-all max-w-[220px]">
                                  {log.target_id}
                                </td>
                                <td className="py-3 px-4 text-center font-mono text-[9px] text-slate-500 whitespace-nowrap">
                                  {log.actor_user_id
                                    ? `${log.actor_user_id.substring(0, 8)}...`
                                    : '系统自带'}
                                </td>
                                <td className="py-3 px-4 text-center font-mono text-[10px] text-slate-500 whitespace-nowrap">
                                  <div className="flex items-center justify-center space-x-1">
                                    <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                                    <span>{new Date(log.created_at).toLocaleString()}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                    className="p-1 rounded border border-border bg-background text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                              {/* Expanded details row */}
                              {isExpanded && (
                                <tr>
                                  <td
                                    colSpan={7}
                                    className="bg-slate-100/30 dark:bg-zinc-950/40 p-4 border-b border-border"
                                  >
                                    <div className="space-y-1.5">
                                      <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                                        日志元数据 (Metadata JSON)
                                      </span>
                                      <pre className="max-h-64 p-3 bg-slate-950 dark:bg-black border border-border rounded-md font-mono text-[10px] text-emerald-400 overflow-auto select-text leading-normal whitespace-pre-wrap break-words">
                                        {JSON.stringify(log.metadata, null, 2)}
                                      </pre>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
export default AccountAdminView
