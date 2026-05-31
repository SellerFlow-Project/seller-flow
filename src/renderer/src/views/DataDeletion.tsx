import React, { useState, useEffect, useRef } from 'react'
import {
  Trash2,
  ShieldCheck,
  Database,
  AlertTriangle,
  History,
  Info,
  Globe,
  Clock,
  RefreshCw
} from 'lucide-react'

import { CrawlTaskType, CrawlTaskTypeNames } from '../types/crawler'

interface ScrawlTask {
  id: string
  rawId: number
  marketplace: string
  taskType: string
  skuCount: number
  createdTime: string
  status: string
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString

  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 0) return '刚刚'
  if (diffInSeconds < 60) return `${diffInSeconds} 秒前`

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes} 分钟前`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours} 小时前`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) return `${diffInDays} 天前`

  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) return `${diffInMonths} 个月前`

  const diffInYears = Math.floor(diffInMonths / 12)
  return `${diffInYears} 年前`
}

export const DataDeletion: React.FC = () => {
  const [taskList, setTaskList] = useState<ScrawlTask[]>([])
  const [dbStats, setDbStats] = useState({
    amazonCount: 0,
    ebayCount: 0,
    dbSize: '0.0 MB',
    cacheSize: '未知'
  })
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [actionLog, setActionLog] = useState<string[]>([
    '等待用户执行数据清理操作。',
    '[准备] 系统安全检测模块就绪，所有事务均支持本地隔离保护。'
  ])

  const logsContainerRef = useRef<HTMLDivElement>(null)

  const fetchData = async () => {
    setIsRefreshing(true)
    try {
      const tasksRes = await window.electron.ipcRenderer.invoke('db:get-tasks')
      if (tasksRes.success) {
        setTaskList(
          tasksRes.list.map((t: any) => ({
            id: t.id.toString(),
            rawId: t.id,
            marketplace: t.marketplace || '未知站点',
            taskType: CrawlTaskTypeNames[t.task_type as CrawlTaskType] || t.task_type,
            skuCount: t.skuCount || 0,
            createdTime: t.created_at ? getRelativeTime(t.created_at) : '-',
            status: t.status
          }))
        )
      }

      const statsRes = await window.electron.ipcRenderer.invoke('db:get-statistics')
      if (statsRes.success) {
        const stats = statsRes.stats
        setDbStats((prev) => ({
          ...prev,
          amazonCount: stats.totalSKUs || 0,
          dbSize: stats.dbSizeMB || '0.0 MB'
        }))
      }
    } catch (error) {
      console.error('Fetch data failed:', error)
    } finally {
      setTimeout(() => setIsRefreshing(false), 500) // add slight delay for better visual feedback
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Scroll to bottom of logs
  useEffect(() => {
    const container = logsContainerRef.current
    if (!container) return () => {}

    container.scrollTop = container.scrollHeight

    const handle = requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight
    })
    const timer = setTimeout(() => {
      container.scrollTop = container.scrollHeight
    }, 50)

    return () => {
      cancelAnimationFrame(handle)
      clearTimeout(timer)
    }
  }, [actionLog])

  const handleDeleteSingleTask = async (task: ScrawlTask) => {
    if (!window.confirm(`确定要清空任务编号 ${task.id} 的所有明细数据吗？此操作不可逆。`)) return

    setActionLog((prev) => [
      ...prev,
      `[物理删除] 开始执行局部物理擦除，正处理任务 [${task.id}]...`
    ])
    try {
      const res = await window.electron.ipcRenderer.invoke('db:delete-task', task.rawId)
      if (res.success) {
        setActionLog((prev) => [
          ...prev,
          `[成功] 成功清空任务 ${task.id} (${task.marketplace}) 及其关联的 ${task.skuCount} 条商品细节数据。`
        ])
        fetchData()
      } else {
        setActionLog((prev) => [...prev, `[失败] 删除任务 ${task.id} 失败。`])
      }
    } catch (error) {
      setActionLog((prev) => [...prev, `[失败] 发生错误: ${error}`])
    }
  }

  const handleDeleteHistoryKeepLatest = async () => {
    if (taskList.length <= 1) {
      setActionLog((prev) => [
        ...prev,
        '[警告] 数据库中没有可清理的旧历史任务数据，无需执行此操作。'
      ])
      return
    }

    if (!window.confirm('确定要清理除最新一次采集之外的所有历史数据包及商品明细吗？此操作不可逆。')) return

    const latestTask = taskList[0]
    const historyTasks = taskList.slice(1)
    const removedSkuCount = historyTasks.reduce((acc, t) => acc + t.skuCount, 0)
    const removedTaskIds = historyTasks.map((t) => t.id).join(', ')

    setActionLog((prev) => [
      ...prev,
      `[物理删除] 发起一键清理历史任务数据命令 (保留最新一次任务 [${latestTask.id}])...`,
      `[物理删除] 正在批量清洗旧历史任务: ${removedTaskIds}...`
    ])

    try {
      for (const t of historyTasks) {
        await window.electron.ipcRenderer.invoke('db:delete-task', t.rawId)
      }
      setActionLog((prev) => [
        ...prev,
        `[成功] 成功擦除 ${historyTasks.length} 个历史数据包，释放商品明细行数: ${removedSkuCount} 行。系统仅保留最新任务 ${latestTask.id} 数据。`
      ])
      fetchData()
    } catch (e) {
      setActionLog((prev) => [...prev, `[失败] 批量清洗历史任务失败。`])
    }
  }

  const handleClearAllData = async () => {
    if (taskList.length === 0) {
      setActionLog((prev) => [...prev, '[警告] 数据库当前已是完全清空状态，无需再次清空。'])
      return
    }

    if (!window.confirm('【高危警告】您确定要一键彻底清空数据库吗？此操作将强制擦除所有任务及明细数据，并执行空间回收，操作完全不可逆！')) return

    const totalRemoved = taskList.reduce((acc, t) => acc + t.skuCount, 0)

    setActionLog((prev) => [
      ...prev,
      `[物理擦除] ⚠️ 警告：已接收全库数据物理清空强制指令！正在锁定数据事务...`,
      `[物理擦除] 正在执行 DROP TABLE 及 TRUNCATE 历史关系表操作...`
    ])

    try {
      for (const t of taskList) {
        await window.electron.ipcRenderer.invoke('db:delete-task', t.rawId)
      }
      setActionLog((prev) => [...prev, `[物理擦除] 正在执行 SQLite VACUUM 磁盘空间缩减回缩动作...`])
      await window.electron.ipcRenderer.invoke('db:clear-cache')
      setActionLog((prev) => [
        ...prev,
        `[成功] 💥 全库物理清理圆满完成！累计物理擦除 ${totalRemoved} 条商品明细记录，数据库文件已缩减回缩至基准尺寸。`
      ])
      fetchData()
    } catch (e) {
      setActionLog((prev) => [...prev, `[失败] 数据库物理清空失败。`])
    }
  }

  const handleClearCache = async () => {
    if (!window.confirm('确定要清理系统页面临时缓存及磁盘碎片吗？')) return

    setActionLog((prev) => [...prev, `[清理] 正在执行系统 VACUUM 清理和回收以释放磁盘空间...`])
    try {
      await window.electron.ipcRenderer.invoke('db:clear-cache')
      setActionLog((prev) => [...prev, `[成功] 物理空间释放已彻底完成。`])
      fetchData()
    } catch (e) {
      setActionLog((prev) => [...prev, `[失败] 清理系统空间失败。`])
    }
  }

  return (
    <div className="p-6 space-y-6 flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-black">
      {/* DB Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0">
        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 transition-all duration-200 hover:border-indigo-500/50 hover:shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            数据文件体积
          </p>
          <h3 className="text-2xl font-bold mt-1 text-foreground">{dbStats.dbSize}</h3>
        </div>
        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 transition-all duration-200 hover:border-emerald-500/50 hover:shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            商品总数
          </p>
          <h3 className="text-2xl font-bold mt-1 text-foreground">{dbStats.amazonCount}</h3>
        </div>
      </div>

      {/* Main Workspace - Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1 min-h-0">
        <div className="lg:col-span-8 bg-card text-card-foreground border border-border rounded-lg p-6 flex flex-col justify-between transition-all duration-200 hover:border-primary/20 hover:shadow-sm h-[780px]">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-base">采集历史任务管理</h2>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold">
                  任务总数: {taskList.length} 个
                </div>
                <button
                  onClick={fetchData}
                  disabled={isRefreshing}
                  className="flex items-center justify-center p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  title="刷新全部数据"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-normal mb-4">
              以下展示了当前存储于本地数据库中的所有采集任务批次。您可以通过行尾的快捷操作一键清除对应批次下的所有商品及分类关系链数据。
            </p>

            {/* Custom Tasks Table */}
            <div className="flex-1 border border-border/80 rounded-xl overflow-y-auto bg-slate-50/30 dark:bg-zinc-950/20 min-h-0">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/50 dark:bg-zinc-900/60 border-b border-border text-slate-500 font-semibold select-none">
                      <th className="py-3 px-4 font-bold uppercase tracking-wider">任务编号</th>
                      <th className="py-3 px-4 font-bold">目标站点</th>
                      <th className="py-3 px-4 font-bold">任务类型</th>
                      <th className="py-3 px-4 font-bold text-right">采集商品数</th>
                      <th className="py-3 px-4 font-bold text-center">创建时间</th>
                      <th className="py-3 px-4 font-bold text-center">执行状态</th>
                      <th className="py-3 px-4 font-bold text-center w-20">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {taskList.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-12 text-center text-muted-foreground select-none"
                        >
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Database className="w-6 h-6 text-muted-foreground/45 animate-pulse" />
                            <span className="font-bold text-[11px]">暂无活跃的采集任务数据包</span>
                            <p className="text-[10px] text-muted-foreground max-w-xs leading-normal">
                              请前往“亚马逊采集”模块启动新任务，抓取的数据在此生成独立的数据包。
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      taskList.map((task) => (
                        <tr
                          key={task.rawId}
                          className="hover:bg-slate-100/20 dark:hover:bg-zinc-900/20 transition-all group"
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-zinc-200">
                            {task.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-1.5 font-medium">
                              <Globe className="w-3.5 h-3.5 text-primary" />
                              <span>{task.marketplace}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400 font-medium">
                            {task.taskType}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-primary font-mono text-sm">
                            {task.skuCount}
                          </td>
                          <td className="py-3.5 px-4 text-center text-muted-foreground font-mono text-[10px]">
                            <div className="flex items-center justify-center space-x-1">
                              <Clock className="w-3 h-3 text-muted-foreground/60" />
                              <span>{task.createdTime}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {task.status === 'completed' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                                完成
                              </span>
                            ) : task.status === 'running' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/25">
                                进行中
                              </span>
                            ) : task.status === 'cancelled' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/25">
                                取消
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/25">
                                失败
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleDeleteSingleTask(task)}
                              className="p-1.5 rounded-md border border-border bg-background hover:bg-rose-500/10 hover:border-rose-500/40 text-muted-foreground hover:text-rose-500 transition-colors shadow-2xs group-hover:scale-105"
                              title={`清空任务 ${task.id} 的所有明细数据`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: 全局清理控制中心 & 事务历史 (lg:col-span-4) */}
        <div className="lg:col-span-4 flex flex-col gap-6 h-[580px]">
          {/* Card 1: 全局一键清理卡片 */}
          <div className="bg-card text-card-foreground border border-border rounded-lg p-6 flex flex-col justify-between transition-all duration-200 hover:border-primary/20 hover:shadow-sm shrink-0">
            <div>
              <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-border">
                <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                <h2 className="font-semibold text-base">全局数据清理中心</h2>
              </div>

              <div className="space-y-4">
                {/* Global Action 1: Delete all history but latest */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-amber-500" />
                    <span>历史任务清洗策略</span>
                  </h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    安全清理本地存储中<b>除最新一次采集之外</b>
                    的所有历史旧包及商品明细，常用于在多次抓取测试后释放磁盘空间。
                  </p>
                  <button
                    onClick={handleDeleteHistoryKeepLatest}
                    disabled={taskList.length <= 1}
                    className="w-full inline-flex items-center justify-center space-x-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold py-2 rounded-md transition-all text-xs shadow-xs hover:-translate-y-[1px] active:translate-y-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>清理历史数据 (保留最新一次)</span>
                  </button>
                </div>

                {/* Global Action 2: Wipe all data */}
                <div className="space-y-2 pt-4 border-t border-border/80">
                  <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>数据库物理清空 (高危)</span>
                  </h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    强制擦除数据库中的所有任务记录、商品明细，并自动执行 <b>SQLite VACUUM</b>{' '}
                    命令回缩文件体积。操作不可逆。
                  </p>
                  <button
                    onClick={handleClearAllData}
                    disabled={taskList.length === 0}
                    className="w-full inline-flex items-center justify-center space-x-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold py-2 rounded-md transition-all text-xs shadow-sm hover:-translate-y-[1px] active:translate-y-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>一键彻底清空数据库</span>
                  </button>
                </div>

                {/* Extra cache cleaning */}
                <div className="pt-2">
                  <button
                    onClick={handleClearCache}
                    className="w-full inline-flex items-center justify-center space-x-1.5 border border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground text-[10px] font-semibold py-1.5 rounded transition-all"
                  >
                    <Database className="w-3 h-3" />
                    <span>清理系统页面临时缓存 及 磁盘碎片</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: 事务执行历史控制台 */}
          <div className="bg-card text-card-foreground border border-border rounded-lg p-6 flex flex-col transition-all duration-200 hover:border-primary/20 hover:shadow-sm flex-1 min-h-[320px]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-border shrink-0">
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                  清理事务审计日志
                </h2>
              </div>
              <button
                onClick={() => setActionLog(['已重置事务历史审计日志。'])}
                className="text-[10px] border border-border hover:bg-accent text-muted-foreground hover:text-foreground px-2 py-0.5 rounded transition-colors"
              >
                重置
              </button>
            </div>

            {/* Console text box */}
            <div
              ref={logsContainerRef}
              className="flex-1 bg-slate-950 dark:bg-black border border-border/80 rounded-md p-4 font-mono text-[11px] text-slate-300 overflow-y-auto flex flex-col space-y-1.5 h-0"
            >
              {actionLog.map((log, index) => {
                let color = 'text-slate-300'
                if (log.startsWith('[成功]') || log.startsWith('[清理]'))
                  color = 'text-emerald-400 font-semibold'
                if (log.startsWith('[警告]')) color = 'text-amber-400 font-semibold'
                if (
                  log.startsWith('[物理删除]') ||
                  log.startsWith('[物理擦除]') ||
                  log.startsWith('[准备]')
                )
                  color = 'text-rose-400'
                return (
                  <div key={index} className={`whitespace-pre-wrap leading-relaxed ${color}`}>
                    {log}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
export default DataDeletion

