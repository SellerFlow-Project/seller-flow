import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Database,
  FileText,
  LogOut,
  Play,
  QrCode,
  Search,
  ShieldAlert,
  Sparkles,
  Square,
  UserCheck
} from 'lucide-react'
import { AmazonMarketplace, MarketplaceConfigs } from '../types/crawler'
import type {
  AmazonSearchConfig,
  AmazonSearchStatus,
  Amz123LoginCode,
  Amz123Session
} from '../../../shared/amazon-search'

const RANK_OPTIONS = ['全部', '1-1000', '1001-10000', '10001-50000', '50000以上']
const CHANGE_OPTIONS = ['全部', '1-50', '51-100', '101-1000', '1000以上']

const INITIAL_STATUS: AmazonSearchStatus = {
  isRunning: false,
  isStopping: false,
  runState: 'idle',
  taskId: null,
  config: null,
  metrics: {
    totalKeywords: 0,
    processedKeywords: 0,
    savedKeywords: 0,
    totalCollected: 0,
    failedKeywords: 0
  }
}

function formatAmz123Expire(expire?: number): string {
  if (!expire) return ''
  return new Date(expire * 1000).toISOString().replace('T', ' ').slice(0, 19)
}

function parseNumberInput(value: string, fallback: number, min = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.floor(parsed)) : fallback
}

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return '0.0s'

  const start = Date.parse(startedAt)
  const end = completedAt ? Date.parse(completedAt) : Date.now()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '0.0s'

  const seconds = Math.round((end - start) / 100) / 10
  if (seconds < 60) return `${seconds.toFixed(1)}s`

  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}m ${rest}s`
}

export const AmazonSearch: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [username, setUsername] = useState('')
  const [tokenExpiry, setTokenExpiry] = useState('')
  const [loginCode, setLoginCode] = useState<Amz123LoginCode | null>(null)
  const [loginStatusText, setLoginStatusText] = useState('等待获取二维码...')
  const [isLoginLoading, setIsLoginLoading] = useState(false)

  const [marketplace, setMarketplace] = useState<AmazonMarketplace>(AmazonMarketplace.JP)
  const [selectedRanks, setSelectedRanks] = useState<string[]>(['全部'])
  const [selectedChanges, setSelectedChanges] = useState<string[]>(['全部'])
  const [minDeliveryInterval, setMinDeliveryInterval] = useState('0')
  const [maxDeliveryInterval, setMaxDeliveryInterval] = useState('30')
  const [matchingProductCount, setMatchingProductCount] = useState('1')
  const [concurrency, setConcurrency] = useState('5')
  const [status, setStatus] = useState<AmazonSearchStatus>(INITIAL_STATUS)
  const [logs, setLogs] = useState<string[]>(['系统就绪，等待用户启动亚马逊搜索词采集任务。'])
  const [isConfigExpanded, setIsConfigExpanded] = useState(true)

  const logsContainerRef = useRef<HTMLDivElement>(null)
  const loginPollTimerRef = useRef<NodeJS.Timeout | null>(null)

  const isCrawling = status.isRunning
  const successRate = useMemo(() => {
    const processed = status.metrics.processedKeywords
    if (processed <= 0) return 100
    return Math.round((status.metrics.savedKeywords / processed) * 100)
  }, [status.metrics.processedKeywords, status.metrics.savedKeywords])
  const durationText = useMemo(
    () => formatDuration(status.metrics.startedAt, status.metrics.completedAt),
    [status.metrics.startedAt, status.metrics.completedAt]
  )
  const keywordProgressPercent = useMemo(() => {
    if (status.metrics.totalKeywords <= 0) return 0
    return Math.min(
      100,
      Math.round((status.metrics.processedKeywords / status.metrics.totalKeywords) * 100)
    )
  }, [status.metrics.processedKeywords, status.metrics.totalKeywords])

  useEffect(() => {
    const offLog = window.api.amazonSearch.onLog((log) => {
      setLogs((prev) => [...prev, log])
    })
    const offState = window.api.amazonSearch.onStateChange((nextStatus) => {
      setStatus(nextStatus)
    })

    void window.api.amazonSearch
      .getLocalState()
      .then((state) => {
        applySession(state.session)
        applyConfig(state.config)
        setStatus(state.status)
      })
      .catch((error) => {
        setLogs((prev) => [...prev, `[错误] 读取亚马逊搜索词本地配置失败：${String(error)}`])
      })

    return () => {
      offLog()
      offState()
      stopLoginPolling()
    }
  }, [])

  useEffect(() => {
    const container = logsContainerRef.current
    if (!container) return

    const handle = requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight
    })

    return () => cancelAnimationFrame(handle)
  }, [logs])

  const applySession = (session: Amz123Session | null) => {
    setIsLoggedIn(Boolean(session))
    setUsername(session?.username || '')
    setTokenExpiry(formatAmz123Expire(session?.expire))
  }

  const applyConfig = (config: AmazonSearchConfig) => {
    setMarketplace(config.marketplace as AmazonMarketplace)
    setSelectedRanks(config.selectedRanks)
    setSelectedChanges(config.selectedChanges)
    setMinDeliveryInterval(String(config.minDeliveryInterval))
    setMaxDeliveryInterval(String(config.maxDeliveryInterval))
    setMatchingProductCount(String(config.matchingProductCount))
    setConcurrency(String(config.concurrency || 5))
  }

  const buildConfig = (): AmazonSearchConfig => {
    const minDays = parseNumberInput(minDeliveryInterval, 0)
    const maxDays = Math.max(minDays, parseNumberInput(maxDeliveryInterval, 30))

    return {
      marketplace,
      selectedRanks,
      selectedChanges,
      minDeliveryInterval: minDays,
      maxDeliveryInterval: maxDays,
      matchingProductCount: parseNumberInput(matchingProductCount, 1, 1),
      concurrency: parseNumberInput(concurrency, 5, 1)
    }
  }

  const handleRankToggle = (value: string) => {
    if (value === '全部') {
      setSelectedRanks(['全部'])
      return
    }

    setSelectedRanks((prev) => {
      const filtered = prev.filter((item) => item !== '全部')
      if (filtered.includes(value)) {
        const next = filtered.filter((item) => item !== value)
        return next.length > 0 ? next : ['全部']
      }

      return [...filtered, value]
    })
  }

  const handleChangeToggle = (value: string) => {
    if (value === '全部') {
      setSelectedChanges(['全部'])
      return
    }

    setSelectedChanges((prev) => {
      const filtered = prev.filter((item) => item !== '全部')
      if (filtered.includes(value)) {
        const next = filtered.filter((item) => item !== value)
        return next.length > 0 ? next : ['全部']
      }

      return [...filtered, value]
    })
  }

  const stopLoginPolling = () => {
    if (loginPollTimerRef.current) {
      clearInterval(loginPollTimerRef.current)
      loginPollTimerRef.current = null
    }
  }

  const startLoginPolling = (ticket: string) => {
    stopLoginPolling()
    loginPollTimerRef.current = setInterval(() => {
      void window.api.amazonSearch
        .pollLoginStatus(ticket)
        .then((result) => {
          setLoginStatusText(result.message)
          if (result.action === 1 && result.session) {
            stopLoginPolling()
            applySession(result.session)
            setShowLoginModal(false)
            setLogs((prev) => [
              ...prev,
              '[成功] 登录 AMZ123 成功。',
              `[AMZ123] 登录用户：${result.session?.username || ''}`,
              `[AMZ123] token 过期时间：${formatAmz123Expire(result.session?.expire)}`
            ])
          } else if (result.action === -1) {
            stopLoginPolling()
          }
        })
        .catch((error) => {
          setLoginStatusText(`轮询失败：${String(error)}`)
        })
    }, 1000)
  }

  const requestLoginCode = async () => {
    setIsLoginLoading(true)
    setLoginStatusText('正在获取 AMZ123 二维码...')
    setLoginCode(null)
    stopLoginPolling()

    try {
      const code = await window.api.amazonSearch.requestLoginCode()
      setLoginCode(code)
      setLoginStatusText('等待扫码确认。')
      startLoginPolling(code.ticket)
    } catch (error) {
      setLoginStatusText(`获取二维码失败：${String(error)}`)
    } finally {
      setIsLoginLoading(false)
    }
  }

  const handleLoginClick = () => {
    setShowLoginModal(true)
    void requestLoginCode()
  }

  const handleLogout = async () => {
    try {
      await window.api.amazonSearch.logout()
      applySession(null)
      setLogs((prev) => [...prev, '[AMZ123] 已退出账号登录。'])
    } catch (error) {
      setLogs((prev) => [...prev, `[错误] 退出 AMZ123 登录失败：${String(error)}`])
    }
  }

  const startCrawl = async () => {
    if (!isLoggedIn) {
      alert('请先登录 AMZ123 账号。')
      return
    }

    const config = buildConfig()
    setLogs([
      '[系统] 正在向主进程发起【亚马逊搜索词采集】任务指令...',
      `[系统] 目标站点: ${MarketplaceConfigs[marketplace].name}`,
      `[参数] 本周排名筛选条件: [${config.selectedRanks.join(', ')}]`,
      `[参数] 涨跌幅度筛选条件: [${config.selectedChanges.join(', ')}]`,
      `[参数] 配送日期间隔: ${config.minDeliveryInterval}-${config.maxDeliveryInterval} 天`,
      `[参数] 符合的商品数量: ${config.matchingProductCount} 个`,
      `[参数] 搜索词并发数: ${config.concurrency}`
    ])

    try {
      await window.api.amazonSearch.saveConfig(config)
      const result = await window.api.amazonSearch.startTask(config)
      setStatus((prev) => ({
        ...prev,
        isRunning: true,
        runState: result.runState,
        taskId: result.taskId,
        config
      }))
    } catch (error) {
      setLogs((prev) => [...prev, `[错误] 启动亚马逊搜索词采集失败：${String(error)}`])
    }
  }

  const stopCrawl = async () => {
    try {
      await window.api.amazonSearch.stopTask()
      setLogs((prev) => [...prev, '[终止] 已请求停止亚马逊搜索词采集任务。'])
    } catch (error) {
      setLogs((prev) => [...prev, `[错误] 停止任务失败：${String(error)}`])
    }
  }

  const clearLogs = () => {
    setLogs(['控制台日志已清空。'])
  }

  const renderOptionPill = (
    option: string,
    selected: boolean,
    onClick: () => void
  ): React.ReactElement => (
    <button
      key={option}
      type="button"
      disabled={isCrawling}
      onClick={onClick}
      className={`px-4 py-1.5 text-xs rounded-full border font-medium transition-all duration-150 select-none cursor-pointer ${
        selected
          ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/10'
          : 'bg-background text-muted-foreground border-border hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-foreground'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {option}
    </button>
  )

  return (
    <div className="p-6 space-y-6 flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-black">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <MetricCard
          label="已采集搜索商品数"
          value={status.metrics.totalCollected}
          suffix="SKU"
          icon={<Database className="w-6 h-6" />}
          colorClass="text-primary"
        />
        <MetricCard
          label="采集成功率"
          value={successRate}
          suffix="%"
          icon={<ShieldAlert className="w-6 h-6" />}
          colorClass="text-emerald-500 dark:text-emerald-400"
        />
        <MetricCard
          label="累计爬网时长"
          value={durationText}
          icon={<Cpu className="w-6 h-6" />}
          colorClass="text-sky-500 dark:text-sky-400"
        />
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-lg transition-all duration-200 hover:border-primary/20 hover:shadow-sm shrink-0">
        <div
          onClick={() => setIsConfigExpanded(!isConfigExpanded)}
          className={`flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-100/30 dark:hover:bg-zinc-900/30 transition-colors rounded-t-lg ${
            !isConfigExpanded ? 'rounded-lg' : 'border-b border-border/60'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded bg-primary/10 text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">新建采集任务</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isCrawling ? '采集引擎运行中，部分配置项已锁定' : '配置亚马逊搜索词采集参数'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3" onClick={(event) => event.stopPropagation()}>
            <div
              className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                isCrawling
                  ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20 animate-pulse'
                  : 'bg-slate-500/10 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-500/10 dark:border-zinc-700'
              }`}
            >
              {isCrawling && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping shrink-0" />
              )}
              <span>{isCrawling ? '任务执行中' : '就绪 (READY)'}</span>
            </div>
            <button className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors text-muted-foreground hover:text-foreground">
              {isConfigExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {isConfigExpanded && (
          <div className="p-5 space-y-5 rounded-b-lg">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  目标站点
                </label>
                <select
                  value={marketplace}
                  onChange={(event) => setMarketplace(event.target.value as AmazonMarketplace)}
                  disabled={isCrawling}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {Object.values(AmazonMarketplace).map((market) => (
                    <option key={market} value={market}>
                      {MarketplaceConfigs[market].name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-8 space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  AMZ123 授权状态
                </label>
                {!isLoggedIn ? (
                  <button
                    onClick={handleLoginClick}
                    disabled={isCrawling}
                    className="w-full h-9 inline-flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-border rounded-md text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <QrCode className="w-4 h-4 text-primary" />
                    <span>登录 AMZ123 账号</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between border border-emerald-500/20 dark:border-emerald-500/30 bg-emerald-500/5 rounded-md px-3 h-9 text-xs">
                    <div className="flex items-center space-x-2 truncate">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-semibold truncate text-slate-800 dark:text-zinc-200">
                        {username}
                      </span>
                    </div>
                    <div
                      className="flex items-center space-x-2 font-mono text-muted-foreground text-[10px] shrink-0"
                      title={`Token过期时间: ${tokenExpiry}`}
                    >
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{tokenExpiry.split(' ')[0]}</span>
                      <button
                        onClick={handleLogout}
                        disabled={isCrawling}
                        className="p-1 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 rounded text-rose-500 transition-colors disabled:opacity-50"
                        title="退出登录"
                      >
                        <LogOut className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-1">
              <FilterGroup title="AMZ123 本周排名">
                {RANK_OPTIONS.map((option) =>
                  renderOptionPill(option, selectedRanks.includes(option), () =>
                    handleRankToggle(option)
                  )
                )}
              </FilterGroup>

              <FilterGroup title="AMZ123 涨跌幅度">
                {CHANGE_OPTIONS.map((option) =>
                  renderOptionPill(option, selectedChanges.includes(option), () =>
                    handleChangeToggle(option)
                  )
                )}
              </FilterGroup>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-5 pt-3 border-t border-border/40">
                <NumberInput
                  label="配送最小日期间隔"
                  value={minDeliveryInterval}
                  onChange={setMinDeliveryInterval}
                  disabled={isCrawling}
                  unit="天"
                />
                <NumberInput
                  label="配送最大日期间隔"
                  value={maxDeliveryInterval}
                  onChange={setMaxDeliveryInterval}
                  disabled={isCrawling}
                  unit="天"
                />
                <NumberInput
                  label="符合的商品数量"
                  value={matchingProductCount}
                  onChange={setMatchingProductCount}
                  disabled={isCrawling}
                  unit="个"
                  min={1}
                />
                <NumberInput
                  label="并发数"
                  value={concurrency}
                  onChange={setConcurrency}
                  disabled={isCrawling}
                  unit="个"
                  min={1}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-4 pt-3 border-t border-border/40">
              <div className="text-xs text-muted-foreground flex items-center space-x-1.5">
                {isLoggedIn ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                )}
                <span>
                  {isLoggedIn
                    ? '已联接 AMZ123，可启动搜索词采集任务'
                    : '请先登录 AMZ123 账号以获取搜索词列表'}
                </span>
              </div>

              {!isCrawling ? (
                <button
                  onClick={startCrawl}
                  disabled={!isLoggedIn}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-primary text-primary-foreground font-medium px-5 py-2 rounded-md hover:bg-primary/95 transition-all duration-150 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <Play className="w-4 h-4" />
                  <span>开启搜索词采集</span>
                </button>
              ) : (
                <button
                  onClick={stopCrawl}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-destructive text-destructive-foreground font-medium px-5 py-2 rounded-md hover:bg-destructive/95 transition-all duration-150 hover:-translate-y-[1px] active:translate-y-0"
                >
                  <Square className="w-4 h-4 animate-pulse" />
                  <span>停止采集进程</span>
                </button>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 border border-border/65 rounded-md p-3.5">
              <h4 className="text-xs font-bold uppercase text-primary mb-1 flex items-center space-x-1.5">
                <Search className="w-3.5 h-3.5 text-primary" />
                <span>亚马逊搜索词采集说明</span>
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                系统会先调用 AMZ123 获取搜索词，再按商品详情节点策略访问 Amazon
                搜索结果页，根据配送天数和匹配商品数量筛选，符合条件的搜索词与商品会写入本地
                SQLite。
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-sm transition-all duration-200 hover:border-primary/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded bg-primary/10 text-primary">
                <Search className="w-4 h-4" />
              </div>
              <h2 className="font-semibold text-sm">搜索词采集进度</h2>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              当前已处理 {status.metrics.processedKeywords} / {status.metrics.totalKeywords}{' '}
              个搜索词， 已保存符合条件搜索词 {status.metrics.savedKeywords} 个
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-primary">{keywordProgressPercent}%</span>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">
              {isCrawling ? `并发 ${status.config?.concurrency || concurrency}` : '等待任务启动'}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2.5 rounded-full bg-slate-100 dark:bg-zinc-900 overflow-hidden border border-border/60">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${keywordProgressPercent}%` }}
          />
        </div>
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-lg p-6 flex flex-col transition-all duration-200 hover:border-primary/20 hover:shadow-sm flex-1 min-h-[400px]">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border shrink-0">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-base">实时采集日志</h2>
          </div>
          <button
            onClick={clearLogs}
            className="text-xs border border-border hover:bg-accent text-muted-foreground hover:text-foreground px-2.5 py-1 rounded transition-colors"
          >
            清空日志
          </button>
        </div>

        <div
          ref={logsContainerRef}
          className="flex-1 bg-slate-950 dark:bg-black border border-border/80 rounded-md p-4 font-mono text-[11px] text-slate-300 overflow-y-auto flex flex-col space-y-1.5 min-h-[220px]"
        >
          {logs.map((log, index) => (
            <div
              key={`${index}-${log}`}
              className={`whitespace-pre-wrap leading-relaxed ${getLogColor(log)}`}
            >
              {log}
            </div>
          ))}
        </div>
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
            onClick={() => {
              setShowLoginModal(false)
              stopLoginPolling()
            }}
          />

          <div className="relative w-full max-w-sm bg-white/95 dark:bg-zinc-950/95 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl shadow-2xl shadow-primary/10 overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-primary animate-pulse" />
                <h3 className="font-bold text-sm text-foreground">AMZ123 扫码登录</h3>
              </div>
              <button
                onClick={() => {
                  setShowLoginModal(false)
                  stopLoginPolling()
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-base leading-none">×</span>
              </button>
            </div>

            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative p-4 bg-white rounded-xl border border-slate-200 shadow-inner min-h-48 min-w-48 flex items-center justify-center">
                {loginCode ? (
                  <img src={loginCode.imageDataUrl} alt="AMZ123 登录二维码" className="w-44 h-44" />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-xs text-muted-foreground">
                    {isLoginLoading ? '二维码加载中...' : '暂无二维码'}
                  </div>
                )}
                <div className="absolute inset-0 m-4 overflow-hidden pointer-events-none">
                  <div className="w-full h-0.5 bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-[scan-line_2.5s_linear_infinite]" />
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-4 text-center leading-relaxed">
                请使用微信扫描二维码完成 AMZ123 授权。
                <br />
                <span className="text-primary font-semibold">{loginStatusText}</span>
              </p>
            </div>

            <div className="pt-4 border-t border-border/60 flex flex-col space-y-2">
              <button
                onClick={requestLoginCode}
                disabled={isLoginLoading}
                className="w-full py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-lg hover:bg-primary/95 hover:shadow-md transition-all flex items-center justify-center space-x-1.5 disabled:opacity-60"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{isLoginLoading ? '正在刷新...' : '刷新二维码'}</span>
              </button>
              <button
                onClick={() => {
                  setShowLoginModal(false)
                  stopLoginPolling()
                }}
                className="w-full py-2 border border-border bg-background hover:bg-slate-100 dark:hover:bg-zinc-900 font-semibold text-xs rounded-lg text-slate-700 dark:text-zinc-300 transition-colors"
              >
                返回
              </button>
            </div>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes scan-line {
              0% { transform: translateY(0); }
              50% { transform: translateY(176px); }
              100% { transform: translateY(0); }
            }
          `
        }}
      />
    </div>
  )
}

function MetricCard({
  label,
  value,
  suffix,
  icon,
  colorClass
}: {
  label: string
  value: string | number
  suffix?: string
  icon: React.ReactNode
  colorClass: string
}): React.ReactElement {
  return (
    <div className="bg-card text-card-foreground border border-border rounded-lg p-5 flex items-center justify-between transition-all duration-200 hover:border-primary/50 hover:shadow-sm">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <h3 className={`text-2xl font-bold mt-1 ${colorClass}`}>
          {value}{' '}
          {suffix && <span className="text-xs font-normal text-muted-foreground">{suffix}</span>}
        </h3>
      </div>
      <div className={`p-3 rounded-lg bg-primary/10 ${colorClass}`}>{icon}</div>
    </div>
  )
}

function FilterGroup({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center space-x-1.5">
        <span>{title}</span>
        <span className="text-[10px] text-muted-foreground lowercase normal-case">(多选)</span>
      </label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function NumberInput({
  label,
  value,
  onChange,
  disabled,
  unit,
  min = 0
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  unit: string
  min?: number
}): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[10px] text-muted-foreground lowercase normal-case">
          单位：{unit}
        </span>
      </label>
      <div className="relative">
        <input
          type="number"
          min={min}
          placeholder="请输入"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="w-full bg-background border border-border rounded-md pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-muted-foreground">
          {unit}
        </div>
      </div>
    </div>
  )
}

function getLogColor(log: string): string {
  if (log.startsWith('[成功]') || log.includes('✅') || log.includes('完成')) {
    return 'text-emerald-400 font-semibold'
  }
  if (log.startsWith('[警告]') || log.startsWith('[恢复]')) return 'text-amber-400 font-semibold'
  if (
    log.startsWith('[开始]') ||
    log.startsWith('[参数]') ||
    log.startsWith('[系统]') ||
    log.startsWith('[AMZ123]')
  ) {
    return 'text-sky-400'
  }
  if (log.startsWith('[终止]') || log.startsWith('[错误]')) return 'text-rose-400'
  if (log.startsWith('[数据]') || log.startsWith('[搜索]') || log.startsWith('[卖家精灵]')) {
    return 'text-indigo-400'
  }
  return 'text-slate-300'
}

export default AmazonSearch
