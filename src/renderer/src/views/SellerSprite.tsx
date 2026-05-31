import React, { useState, useEffect, useMemo } from 'react'
import {
  UserPlus,
  Trash2,
  Eye,
  EyeOff,
  Check,
  Plus,
  RefreshCw,
  AlertCircle,
  Inbox,
  Lock,
  User,
  Clock,
  ShieldAlert,
  Bot
} from 'lucide-react'
import { useAppStore } from '../store/appStore'

// 卖家精灵账号接口定义
interface SpriteAccount {
  id: number
  username: string
  password: string
  status: 'normal' | 'invalid'
  created_at: string
  updated_at: string
}

export const SellerSprite: React.FC = () => {
  const activeTab = useAppStore((state) => state.activeTab)

  // 核心数据状态
  const [accounts, setAccounts] = useState<SpriteAccount[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // 交互逻辑状态
  const [showAddModal, setShowAddModal] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  // 密码明文显示控制，Map<id, boolean>
  const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({})

  // 二次确认弹窗控制
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean
    title: string
    message: string
    actionType: 'delete_single' | 'delete_invalid' | 'delete_all'
    targetId?: number
  }>({
    show: false,
    title: '',
    message: '',
    actionType: 'delete_single'
  })

  // 1. 获取所有账号
  const fetchAccounts = async () => {
    setIsLoading(true)
    try {
      const res = await window.electron.ipcRenderer.invoke('db:get-sprite-accounts')
      if (res.success && res.list) {
        setAccounts(res.list)
      }
    } catch (err) {
      console.error('[SellerSprite] 获取账号失败:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // 当切入此页面时，自动刷新数据
  useEffect(() => {
    if (activeTab === 'seller-sprite') {
      fetchAccounts()
    }
  }, [activeTab])

  // 2. 新增账号提交
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)

    const u = usernameInput.trim()
    const p = passwordInput.trim()

    if (!u || !p) {
      setAddError('账号或密码不能为空！')
      return
    }

    // 重名检查 (防止 SQLite UNIQUE 约束抛出粗糙报错)
    if (accounts.some((acc) => acc.username.toLowerCase() === u.toLowerCase())) {
      setAddError('该账号用户名已存在，请勿重复添加！')
      return
    }

    try {
      const res = await window.electron.ipcRenderer.invoke('db:add-sprite-account', {
        username: u,
        password: p
      })

      if (res.success) {
        setUsernameInput('')
        setPasswordInput('')
        setShowAddModal(false)
        fetchAccounts()
      } else {
        setAddError(res.error || '添加账号失败，请重试！')
      }
    } catch (err: any) {
      setAddError(err.message || '与主进程通信异常')
    }
  }

  // 3. 切换状态 (正常 <-> 失效)
  const toggleAccountStatus = async (id: number, currentStatus: 'normal' | 'invalid') => {
    const nextStatus = currentStatus === 'normal' ? 'invalid' : 'normal'
    try {
      const res = await window.electron.ipcRenderer.invoke('db:update-sprite-account-status', {
        id,
        status: nextStatus
      })
      if (res.success) {
        fetchAccounts()
      }
    } catch (err) {
      console.error('[SellerSprite] 更新状态失败:', err)
    }
  }

  // 4. 打开确认删除弹窗
  const openConfirmDelete = (
    actionType: 'delete_single' | 'delete_invalid' | 'delete_all',
    targetId?: number,
    username?: string
  ) => {
    if (actionType === 'delete_single') {
      setConfirmModal({
        show: true,
        title: '删除单个账号确认',
        message: `您确定要删除卖家精灵账号 「${username}」 吗？此操作将物理擦除该数据且无法恢复。`,
        actionType,
        targetId
      })
    } else if (actionType === 'delete_invalid') {
      setConfirmModal({
        show: true,
        title: '一键清除失效账号确认',
        message: '您确定要一键删除所有状态为 「已失效」 的卖家精灵账号吗？该清理无法撤销。',
        actionType
      })
    } else if (actionType === 'delete_all') {
      setConfirmModal({
        show: true,
        title: '一键删除所有账号确认',
        message: '🚨 警告：您确定要一键清空本地所有卖家精灵的账号数据吗？该操作属于高危动作，确认后数据将永久丢失。',
        actionType
      })
    }
  }

  // 5. 执行具体的删除动作
  const executeConfirmAction = async () => {
    const { actionType, targetId } = confirmModal
    setConfirmModal((prev) => ({ ...prev, show: false })) // 关闭确认框

    try {
      if (actionType === 'delete_single' && targetId !== undefined) {
        const res = await window.electron.ipcRenderer.invoke('db:delete-sprite-account', targetId)
        if (res.success) fetchAccounts()
      } else if (actionType === 'delete_invalid') {
        const res = await window.electron.ipcRenderer.invoke('db:clear-sprite-accounts', 'invalid')
        if (res.success) fetchAccounts()
      } else if (actionType === 'delete_all') {
        const res = await window.electron.ipcRenderer.invoke('db:clear-sprite-accounts', 'all')
        if (res.success) fetchAccounts()
      }
    } catch (err) {
      console.error('[SellerSprite] 运行清理事务异常:', err)
    }
  }

  // 密码显隐切换辅助
  const togglePasswordVisibility = (id: number) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // 数据统计指标
  const statistics = useMemo(() => {
    const total = accounts.length
    const normal = accounts.filter((a) => a.status === 'normal').length
    const invalid = total - normal
    return { total, normal, invalid }
  }, [accounts])

  // 格式化时间
  const formatDate = (isoStr: string) => {
    if (!isoStr) return '-'
    try {
      const d = new Date(isoStr)
      if (isNaN(d.getTime())) return isoStr
      const pad = (n: number) => n.toString().padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    } catch {
      return isoStr
    }
  }

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto bg-slate-50 dark:bg-black pb-12">
      {/* 1. 顶部面板标题 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-purple-500/10 text-purple-500 rounded">
              <Bot className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-foreground">卖家精灵账号管理 (SellerSprite Accounts)</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            配置与维护卖家精灵账号，用于抓取或进行关键词分析
          </p>
        </div>

        {/* 新增动作区 */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={fetchAccounts}
            className="inline-flex items-center space-x-1 border border-border bg-card text-xs font-semibold py-2 px-3 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200"
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>刷新列表</span>
          </button>

          <button
            onClick={() => {
              setAddError(null)
              setShowAddModal(true)
            }}
            className="inline-flex items-center space-x-1.5 bg-purple-600 text-white text-xs font-bold py-2 px-3.5 rounded-md hover:bg-purple-600/90 shadow-sm transition-all duration-150"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>新增账号</span>
          </button>
        </div>
      </div>

      {/* 2. 统计指标卡片 Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 flex items-center justify-between shadow-sm transition-all duration-200 hover:border-purple-500/20">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">总配置账号数</p>
            <h3 className="text-2xl font-black mt-1 text-purple-600 dark:text-purple-400">{statistics.total} <span className="text-xs font-normal text-muted-foreground">组</span></h3>
          </div>
          <div className="p-3 rounded-lg bg-purple-600/10 text-purple-600">
            <User className="w-5.5 h-5.5" />
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 flex items-center justify-between shadow-sm transition-all duration-200 hover:border-emerald-500/20">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">正常账号数量</p>
            <h3 className="text-2xl font-black mt-1 text-emerald-500 dark:text-emerald-400">{statistics.normal} <span className="text-xs font-normal text-muted-foreground">正常可用</span></h3>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Check className="w-5.5 h-5.5" />
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 flex items-center justify-between shadow-sm transition-all duration-200 hover:border-rose-500/20">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">失效账号数量</p>
            <h3 className="text-2xl font-black mt-1 text-rose-500">{statistics.invalid} <span className="text-xs font-normal text-muted-foreground">待维护</span></h3>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500">
            <AlertCircle className="w-5.5 h-5.5" />
          </div>
        </div>
      </div>

      {/* 3. 核心数据表格 Card */}
      <div className="bg-card text-card-foreground border border-border rounded-lg p-6 shadow-sm flex flex-col justify-between transition-all duration-200 hover:border-purple-500/10 min-h-[300px] relative">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-border gap-3">
            <div className="flex items-center space-x-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-purple-500" />
              <h3 className="font-bold text-sm">本地账号列表</h3>
            </div>

            {/* 一键批量清理工具 */}
            {accounts.length > 0 && (
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => openConfirmDelete('delete_invalid')}
                  className="inline-flex items-center space-x-1.5 border border-border bg-background hover:bg-rose-500/5 text-rose-500 hover:border-rose-500/30 text-2xs font-semibold py-1.5 px-3 rounded"
                  title="清理失效账号"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>一键删除失效账号</span>
                </button>

                <button
                  onClick={() => openConfirmDelete('delete_all')}
                  className="inline-flex items-center space-x-1.5 border border-border bg-background hover:bg-rose-600 text-rose-600 hover:text-white hover:border-rose-600 text-2xs font-bold py-1.5 px-3 rounded transition-colors"
                  title="清除全部账号"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>一键删除所有账号</span>
                </button>
              </div>
            )}
          </div>

          {/* 表格 */}
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-slate-50 dark:bg-slate-900/50 text-xs font-bold text-muted-foreground uppercase">
                  <th className="py-3.5 px-4 font-bold w-12 text-center">ID</th>
                  <th className="py-3.5 px-4 font-bold">账号用户名</th>
                  <th className="py-3.5 px-4 font-bold w-48">密码</th>
                  <th className="py-3.5 px-4 font-bold w-36 text-center">状态 (点击可切换)</th>
                  <th className="py-3.5 px-4 font-bold w-44">添加时间</th>
                  <th className="py-3.5 px-4 font-bold w-20 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {accounts.length > 0 ? (
                  accounts.map((acc, index) => {
                    const isPassVisible = !!visiblePasswords[acc.id]
                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors duration-150">
                        {/* ID */}
                        <td className="py-3.5 px-4 text-center text-muted-foreground font-semibold">{index + 1}</td>

                        {/* 账号 */}
                        <td className="py-3.5 px-4 font-bold text-foreground flex items-center space-x-2">
                          <User className="w-3.5 h-3.5 text-muted-foreground/60" />
                          <span>{acc.username}</span>
                        </td>

                        {/* 密码掩码显示与切换 */}
                        <td className="py-3.5 px-4 font-mono font-medium text-foreground">
                          <div className="flex items-center space-x-2">
                            <Lock className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                            <span className="tracking-wide">
                              {isPassVisible ? acc.password : '••••••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(acc.id)}
                              className="text-muted-foreground hover:text-purple-500 p-0.5 rounded shrink-0 transition-colors"
                              title={isPassVisible ? '隐藏密码' : '明文显示密码'}
                            >
                              {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>

                        {/* 账号状态，支持快捷点击一键反转 */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => toggleAccountStatus(acc.id, acc.status)}
                            className="focus:outline-none transition-transform active:scale-95"
                            title="点击切换账号状态"
                          >
                            {acc.status === 'normal' ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-2xs font-extrabold cursor-pointer hover:bg-emerald-500/25 transition-all">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span>正常可用</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 text-2xs font-extrabold cursor-pointer hover:bg-rose-500/25 transition-all">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                <span>失效待换</span>
                              </span>
                            )}
                          </button>
                        </td>

                        {/* 添加时间 */}
                        <td className="py-3.5 px-4 text-muted-foreground font-mono flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                          <span>{formatDate(acc.created_at)}</span>
                        </td>

                        {/* 删除快捷按钮 */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => openConfirmDelete('delete_single', acc.id, acc.username)}
                            className="p-1 border border-border rounded text-muted-foreground hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/5 transition-all"
                            title="物理删除该账号"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Inbox className="w-8 h-8 text-muted-foreground/45" />
                        <p className="font-bold">暂无卖家精灵账号</p>
                        <p className="text-2xs text-muted-foreground max-w-xs">
                          请点击右上角的“新增账号”按钮，在本地数据库中配置账号池。
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. 新增账号浮窗 (Add Account Form Modal) */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-card text-card-foreground border border-border rounded-lg max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <Plus className="w-4 h-4 text-purple-500" />
                <h4 className="font-extrabold text-sm text-foreground">新增卖家精灵账号</h4>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground font-black px-2 py-1 rounded hover:bg-muted"
              >
                关闭
              </button>
            </div>

            {/* Error Alert */}
            {addError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs px-3.5 py-2.5 rounded-md flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{addError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-purple-500" />
                  <span>账号用户名</span>
                </label>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="请输入手机号 / 邮箱用户名..."
                  className="w-full bg-background border border-border rounded-md px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-purple-500" />
                  <span>账号密码</span>
                </label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="请输入该账号登录密码..."
                  className="w-full bg-background border border-border rounded-md px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="border border-border bg-background hover:bg-accent text-2xs font-semibold py-2 px-4 rounded-md transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-600/90 text-white text-2xs font-bold py-2 px-4 rounded-md shadow-sm transition-all"
                >
                  确认新增
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. 💡 二次安全确认弹窗 (Custom HUD Double Confirmation Dialog) */}
      {confirmModal.show && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setConfirmModal((prev) => ({ ...prev, show: false }))}
        >
          <div
            className="bg-card text-card-foreground border border-border rounded-lg max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Caution Icon */}
            <div className="flex items-center space-x-2 text-rose-500">
              <span className="p-1.5 bg-rose-500/10 rounded">
                <ShieldAlert className="w-5 h-5 shrink-0" />
              </span>
              <h4 className="font-extrabold text-sm text-foreground">{confirmModal.title}</h4>
            </div>

            {/* Description */}
            <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
              {confirmModal.message}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, show: false }))}
                className="border border-border bg-background hover:bg-accent text-2xs font-semibold py-1.5 px-3.5 rounded transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={executeConfirmAction}
                className="bg-rose-600 hover:bg-rose-600/90 text-white text-2xs font-bold py-1.5 px-3.5 rounded shadow-sm transition-all"
              >
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部缓冲留白，确保滚动到底部呼吸感 */}
      <div className="h-6 shrink-0" />
    </div>
  )
}
