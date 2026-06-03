import React, { useState, useEffect, useRef } from 'react'
import {
  Play,
  Square,
  FileText,
  Database,
  ShieldAlert,
  Cpu,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  GitBranch,
  ArrowRight,
  Activity,
  Grid,
  RotateCcw
} from 'lucide-react'
import {
  CrawlTaskType,
  CrawlTaskTypeNames,
  AmazonMarketplace,
  MarketplaceConfigs
} from '../types/crawler'

const DELIVERY_DETAIL_BATCH_SIZE = 100

interface DeliveryDetailQueueItem {
  productId: number
  asin: string
  status: 'pending' | 'fetching' | 'success' | 'failed'
  title?: string
  deliveryDays?: string | null
  error?: string
}

interface DeliveryDetailState {
  phase:
    | 'idle'
    | 'waiting'
    | 'running'
    | 'risk_control_cooldown'
    | 'stopping'
    | 'failed'
    | 'completed'
  batchSize: number
  concurrency: number
  batchNumber: number
  totalSucceeded: number
  totalFailed: number
  waitingProductCount: number
  lastError?: string
  queue: DeliveryDetailQueueItem[]
}

const EMPTY_DELIVERY_DETAIL_STATE: DeliveryDetailState = {
  phase: 'idle',
  batchSize: DELIVERY_DETAIL_BATCH_SIZE,
  concurrency: 1,
  batchNumber: 0,
  totalSucceeded: 0,
  totalFailed: 0,
  waitingProductCount: 0,
  queue: []
}

const EMPTY_DELIVERY_DETAIL_QUEUE: DeliveryDetailQueueItem[] = Array.from(
  { length: DELIVERY_DETAIL_BATCH_SIZE },
  (_, index) => ({
    productId: -(index + 1),
    asin: '-',
    status: 'pending'
  })
)

interface AdjustableAmazonCategory {
  name: string
  href: string
  enabled: boolean
}

interface AmazonCategoryPreference extends AdjustableAmazonCategory {
  order: number
}

type AmazonCategoryPreferenceStore = Record<string, AmazonCategoryPreference[]>

const AMAZON_CATEGORY_PREFERENCE_STORAGE_KEY = 'sellerflow.amazon.category-preferences.v1'

function buildCategoryPreferenceKey(
  taskType: CrawlTaskType,
  marketplace: AmazonMarketplace
): string {
  return `${taskType}:${marketplace}`
}

function normalizeCategoryValue(value: string): string {
  return value.trim().toLowerCase()
}

function isCategoryPreference(value: unknown): value is AmazonCategoryPreference {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<AmazonCategoryPreference>
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.href === 'string' &&
    typeof candidate.enabled === 'boolean' &&
    typeof candidate.order === 'number'
  )
}

function readCategoryPreferenceStore(): AmazonCategoryPreferenceStore {
  try {
    const raw = window.localStorage.getItem(AMAZON_CATEGORY_PREFERENCE_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.entries(parsed as Record<string, unknown>).reduce<AmazonCategoryPreferenceStore>(
      (acc, [key, value]) => {
        if (Array.isArray(value)) {
          acc[key] = value.filter(isCategoryPreference)
        }
        return acc
      },
      {}
    )
  } catch (error) {
    console.error('[AmazonCollection] 读取分类偏好失败:', error)
    return {}
  }
}

function loadCategoryPreferences(
  taskType: CrawlTaskType,
  marketplace: AmazonMarketplace
): AmazonCategoryPreference[] {
  const store = readCategoryPreferenceStore()
  return store[buildCategoryPreferenceKey(taskType, marketplace)] ?? []
}

function saveCategoryPreferences(
  taskType: CrawlTaskType,
  marketplace: AmazonMarketplace,
  categories: AdjustableAmazonCategory[]
): void {
  try {
    const key = buildCategoryPreferenceKey(taskType, marketplace)
    const store = readCategoryPreferenceStore()
    store[key] = categories.map((category, index) => ({
      name: category.name,
      href: category.href,
      enabled: category.enabled,
      order: index
    }))
    window.localStorage.setItem(AMAZON_CATEGORY_PREFERENCE_STORAGE_KEY, JSON.stringify(store))
  } catch (error) {
    console.error('[AmazonCollection] 保存分类偏好失败:', error)
  }
}

function findCategoryPreference(
  category: AdjustableAmazonCategory,
  preferences: AmazonCategoryPreference[]
): AmazonCategoryPreference | undefined {
  const categoryHref = normalizeCategoryValue(category.href)
  const categoryName = normalizeCategoryValue(category.name)

  return preferences.find((preference) => {
    const preferenceHref = normalizeCategoryValue(preference.href)
    const preferenceName = normalizeCategoryValue(preference.name)
    return (
      (categoryHref.length > 0 && preferenceHref === categoryHref) ||
      (categoryName.length > 0 && preferenceName === categoryName)
    )
  })
}

function mergeLiveCategoriesWithPreferences(
  liveCategories: AdjustableAmazonCategory[],
  preferences: AmazonCategoryPreference[]
): AdjustableAmazonCategory[] {
  return liveCategories
    .map((category, liveIndex) => {
      const preference = findCategoryPreference(category, preferences)
      return {
        category: {
          ...category,
          enabled: preference?.enabled ?? true
        },
        liveIndex,
        preferenceOrder: preference?.order
      }
    })
    .sort((left, right) => {
      const leftHasPreference = typeof left.preferenceOrder === 'number'
      const rightHasPreference = typeof right.preferenceOrder === 'number'

      if (leftHasPreference && rightHasPreference) {
        return (
          (left.preferenceOrder ?? 0) - (right.preferenceOrder ?? 0) ||
          left.liveIndex - right.liveIndex
        )
      }

      if (leftHasPreference !== rightHasPreference) {
        return leftHasPreference ? -1 : 1
      }

      return left.liveIndex - right.liveIndex
    })
    .map((item) => item.category)
}

export const AmazonCollection: React.FC = () => {
  // Use state variables typed from the crawler module to verify Keep-Alive state persistence
  const [taskType, setTaskType] = useState<CrawlTaskType>(CrawlTaskType.BEST_SELLERS)
  const [marketplace, setMarketplace] = useState<AmazonMarketplace>(AmazonMarketplace.JP)
  const [crawlStrategy, setCrawlStrategy] = useState<'strategy1' | 'strategy2'>('strategy1')
  const [isCrawling, setIsCrawling] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [logs, setLogs] = useState<string[]>(['系统就绪，等待用户启动采集任务。'])
  const [metrics, setMetrics] = useState({
    totalCollected: 0,
    successRate: 100,
    avgTime: '0.0s'
  })

  // 💡 Real-time crawl topology states
  const [firstLevelCats, setFirstLevelCats] = useState<string[]>([])
  const [completedPrimaries, setCompletedPrimaries] = useState<string[]>([])
  const [activePath, setActivePath] = useState<{ name: string; depth: number }[]>([])
  const [isPanelExpanded, setIsPanelExpanded] = useState(true)
  const [isConfigExpanded, setIsConfigExpanded] = useState(true)

  // 💡 Category Customization States
  const [isFetchingCats, setIsFetchingCats] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [preparedTaskType, setPreparedTaskType] = useState<CrawlTaskType | null>(null)
  const [preparedMarketplace, setPreparedMarketplace] = useState<AmazonMarketplace | null>(null)
  const [tempCategories, setTempCategories] = useState<AdjustableAmazonCategory[]>([])
  const [originalCategories, setOriginalCategories] = useState<AdjustableAmazonCategory[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const [deliveryDetail, setDeliveryDetail] = useState<DeliveryDetailState>(
    EMPTY_DELIVERY_DETAIL_STATE
  )

  const logsContainerRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom of logs (restricted to the logs container only, preventing whole page scrolling)
  useEffect(() => {
    const container = logsContainerRef.current
    if (!container) return () => {}

    // Scroll immediately
    container.scrollTop = container.scrollHeight

    // Use both requestAnimationFrame and a small timeout to guarantee scrolling to the absolute bottom
    // after the browser has completed layout and rendering of the newly appended logs.
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
  }, [logs])

  // IPC Event Gateway: 绑定主进程流式回传的实时爬虫进度日志和 DFS 状态拓扑
  useEffect(() => {
    const handleLogProgress = (_event: any, log: string) => {
      setLogs((prev) => {
        const next = [...prev, log]
        return next.length > 300 ? next.slice(next.length - 300) : next
      })

      // 智能解析日志，提取已采集商品行数和统计指标
      if (log.includes('[写入DB]') || log.includes('[数据]')) {
        const match = log.match(/入库\s*(\d+)\s*个/)
        const count = match ? parseInt(match[1], 10) : 1
        setMetrics((prev) => {
          const nextCount = prev.totalCollected + count
          const duration = (nextCount * 0.9).toFixed(1)
          return {
            totalCollected: nextCount,
            successRate: 100,
            avgTime: `${duration}s`
          }
        })
      }
    }

    const handleStateUpdate = (_event: any, state: any) => {
      if (state.firstLevelCats) setFirstLevelCats(state.firstLevelCats)
      if (state.completedPrimaries) setCompletedPrimaries(state.completedPrimaries)
      if (state.activePath) setActivePath(state.activePath)
      if (typeof state.isCrawling === 'boolean') setIsCrawling(state.isCrawling)
      if (typeof state.runState === 'string') setIsStopping(state.runState === 'stopping')
      if (state.deliveryDetail) setDeliveryDetail(state.deliveryDetail)
    }

    // 监听主进程的流式通信消息与拓扑状态广播
    window.electron.ipcRenderer.on('crawler:log-progress', handleLogProgress)
    window.electron.ipcRenderer.on('crawler:state-update', handleStateUpdate)

    // 挂载时检测主进程后台是否有正在执行的采集任务 (实现跨视图状态无缝续接)
    const checkActiveCrawler = async () => {
      try {
        const status = await window.electron.ipcRenderer.invoke('crawler:get-status')
        if (status.success) {
          setIsCrawling(status.isRunning === true)
          setIsStopping(status.isStopping === true)
          if (status.isRunning && status.config) {
            setTaskType(status.config.taskType as CrawlTaskType)
            setMarketplace(status.config.marketplace as AmazonMarketplace)
            if (status.config.crawlStrategy) {
              setCrawlStrategy(status.config.crawlStrategy as 'strategy1' | 'strategy2')
            }
            setLogs((prev) => {
              const message = status.isStopping
                ? '[系统] 检测到后台任务正在停止，状态已无缝续接。'
                : '[系统] 检测到后台正在运行采集任务，状态已无缝续接。'
              const next = [...prev, message]
              return next.length > 300 ? next.slice(next.length - 300) : next
            })
          }
          // 同步初始 DFS 状态
          if (status.firstLevelCats) setFirstLevelCats(status.firstLevelCats)
          if (status.completedPrimaries) setCompletedPrimaries(status.completedPrimaries)
          if (status.activePath) setActivePath(status.activePath)
          if (status.deliveryDetail) setDeliveryDetail(status.deliveryDetail)
        }
      } catch (err) {
        console.error('[AmazonCollection] 检测后台爬虫状态失败:', err)
      }
    }
    checkActiveCrawler()

    return () => {
      // 卸载时注销管道，防止重复绑定内存泄漏
      window.electron.ipcRenderer.removeAllListeners('crawler:log-progress')
      window.electron.ipcRenderer.removeAllListeners('crawler:state-update')
    }
  }, [])

  /**
   * 拦截并开始准备采集：获取分类并打开弹窗
   */
  const startCrawl = async () => {
    const requestedTaskType = taskType
    const requestedMarketplace = marketplace
    setIsFetchingCats(true)
    setPreparedTaskType(null)
    setPreparedMarketplace(null)
    setLogs((prev) => [
      ...prev,
      `[系统] 正在准备开启 ${MarketplaceConfigs[requestedMarketplace].name} ${CrawlTaskTypeNames[requestedTaskType]}...`
    ])
    setLogs((prev) => [...prev, '[系统] 正在动态获取 Cookie 凭证并尝试抓取排行榜顶级分类数据...'])

    try {
      const res = await window.electron.ipcRenderer.invoke('crawler:get-amazon-cookies', {
        marketplace: requestedMarketplace,
        taskType: requestedTaskType
      })

      if (!res.success) {
        throw new Error(res.error || '获取亚马逊 Cookie 或解析排行榜分类失败')
      }

      if (!res.categories || res.categories.length === 0) {
        throw new Error('未能在该站点排行榜页面解析到任何顶级分类')
      }

      const formattedCats: AdjustableAmazonCategory[] = res.categories.map((c: any) => ({
        name: c.name,
        href: c.href,
        enabled: true
      }))
      const savedPreferences = loadCategoryPreferences(requestedTaskType, requestedMarketplace)
      const mergedCats = mergeLiveCategoriesWithPreferences(formattedCats, savedPreferences)

      setOriginalCategories(JSON.parse(JSON.stringify(formattedCats)))
      setTempCategories(mergedCats)
      setPreparedTaskType(requestedTaskType)
      setPreparedMarketplace(requestedMarketplace)
      saveCategoryPreferences(requestedTaskType, requestedMarketplace, mergedCats)
      setShowAdjustModal(true)
      setLogs((prev) => [
        ...prev,
        `[成功] 成功抓取到 ${res.categories.length} 个顶层分类目录，已按本地记忆合并排序和启用状态。`
      ])
    } catch (err: any) {
      const errMsg = err.message || '未知错误'
      setLogs((prev) => [...prev, `[错误] 准备采集任务失败: ${errMsg}`])
    } finally {
      setIsFetchingCats(false)
    }
  }

  /**
   * 确认并正式启动后台异步 DFS 深度采集任务
   */
  const syncCrawlerStatus = async () => {
    try {
      const status = await window.electron.ipcRenderer.invoke('crawler:get-status')
      if (!status.success) return

      setIsCrawling(status.isRunning === true)
      setIsStopping(status.isStopping === true)
      if (status.firstLevelCats) setFirstLevelCats(status.firstLevelCats)
      if (status.completedPrimaries) setCompletedPrimaries(status.completedPrimaries)
      if (status.activePath) setActivePath(status.activePath)
      if (status.deliveryDetail) setDeliveryDetail(status.deliveryDetail)
    } catch (err) {
      console.error('[AmazonCollection] 同步后台爬虫状态失败:', err)
    }
  }

  const confirmAndStartCrawl = async () => {
    if (!preparedTaskType || !preparedMarketplace) {
      alert('排行榜任务尚未准备完成，请重新获取分类。')
      return
    }

    const selectedCategories = tempCategories
      .filter((c) => c.enabled)
      .map((c) => ({ name: c.name, href: c.href }))

    if (selectedCategories.length === 0) {
      alert('请至少保留一个启用的分类进行采集！')
      return
    }

    saveCategoryPreferences(preparedTaskType, preparedMarketplace, tempCategories)
    setShowAdjustModal(false)
    setIsCrawling(true)
    setIsStopping(false)
    setLogs([`[系统] 正在向主进程引擎发起${CrawlTaskTypeNames[preparedTaskType]}深度 DFS 采集指令...`])

    // 重置实时拓扑状态
    setFirstLevelCats([])
    setCompletedPrimaries([])
    setActivePath([])
    setDeliveryDetail(EMPTY_DELIVERY_DETAIL_STATE)

    setMetrics({
      totalCollected: 0,
      successRate: 100,
      avgTime: '0.0s'
    })

    try {
      const res = await window.electron.ipcRenderer.invoke('crawler:start-task', {
        taskType: preparedTaskType,
        marketplace: preparedMarketplace,
        crawlStrategy,
        selectedCategories // 传递过滤并排序后的首级分类列表
      })

      if (!res.success) {
        setLogs((prev) => {
          const next = [...prev, `[错误] 异步采集启动失败: ${res.error || '未知响应'}`]
          return next.length > 300 ? next.slice(next.length - 300) : next
        })
        await syncCrawlerStatus()
      } else {
        setLogs((prev) => {
          const next = [...prev, '[系统] 后台异步采集引擎启动就绪，正在初始化通信，请稍候...']
          return next.length > 300 ? next.slice(next.length - 300) : next
        })
      }
    } catch (err: any) {
      setLogs((prev) => {
        const next = [...prev, `[错误] 与主进程 IPC 消息通信异常: ${err.message}`]
        return next.length > 300 ? next.slice(next.length - 300) : next
      })
      await syncCrawlerStatus()
    }
  }

  /**
   * 取消采集准备
   */
  const cancelCrawlPreparation = () => {
    setShowAdjustModal(false)
    setPreparedTaskType(null)
    setPreparedMarketplace(null)
    setLogs((prev) => [...prev, '[系统] 用户取消了分类调整，采集任务已终止。'])
  }

  /**
   * 分类操作快捷工具方法
   */
  const selectAllCategories = () => {
    setTempCategories((prev) => prev.map((c) => ({ ...c, enabled: true })))
  }

  const deselectAllCategories = () => {
    setTempCategories((prev) => prev.map((c) => ({ ...c, enabled: false })))
  }

  const restoreDefaultCategories = () => {
    setTempCategories(JSON.parse(JSON.stringify(originalCategories)))
  }

  const toggleCategory = (index: number) => {
    setTempCategories((prev) =>
      prev.map((c, i) => (i === index ? { ...c, enabled: !c.enabled } : c))
    )
  }

  /**
   * HTML5 拖拽事件处理
   */
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const updated = [...tempCategories]
    const draggedItem = updated[draggedIndex]
    updated.splice(draggedIndex, 1)
    updated.splice(index, 0, draggedItem)
    setDraggedIndex(index)
    setTempCategories(updated)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  /**
   * 中止后台正在抓取的任务
   */
  const stopCrawl = async () => {
    setLogs((prev) => {
      const next = [...prev, '[系统] 正在发送强行停止信号...']
      return next.length > 300 ? next.slice(next.length - 300) : next
    })
    try {
      const res = await window.electron.ipcRenderer.invoke('crawler:stop-task')
      if (res.success) {
        await syncCrawlerStatus()
        setLogs((prev) => {
          const message = res.accepted
            ? '[系统] 主进程已受理停止请求，正在等待当前网络请求退出并清理状态...'
            : res.runState === 'stopping'
              ? '[系统] 任务已处于停止处理中，请稍候...'
              : '[系统] 当前没有正在运行的采集任务。'
          const next = [...prev, message]
          return next.length > 300 ? next.slice(next.length - 300) : next
        })
      }
    } catch (err: any) {
      setLogs((prev) => {
        const next = [...prev, `[错误] 停止失败: ${err.message}`]
        return next.length > 300 ? next.slice(next.length - 300) : next
      })
    }
  }

  const clearLogs = () => {
    setLogs(['控制台已清空。'])
  }

  // Calculated Queue Stats
  const crawlQueue = deliveryDetail.queue
  const visibleCrawlQueue = crawlQueue.length > 0 ? crawlQueue : EMPTY_DELIVERY_DETAIL_QUEUE
  const successCount = crawlQueue.filter((i) => i.status === 'success').length
  const failedCount = crawlQueue.filter((i) => i.status === 'failed').length
  const fetchingCount = crawlQueue.filter((i) => i.status === 'fetching').length
  const pendingCount = crawlQueue.filter((i) => i.status === 'pending').length
  const completedCount = successCount + failedCount
  const completionPercentage = Math.round((completedCount / deliveryDetail.batchSize) * 100)
  const deliveryPhaseText =
    deliveryDetail.phase === 'running'
      ? `第 ${deliveryDetail.batchNumber} 批执行中`
      : deliveryDetail.phase === 'waiting'
        ? `等待满批 (${deliveryDetail.waitingProductCount}/${deliveryDetail.batchSize})`
        : deliveryDetail.phase === 'risk_control_cooldown'
          ? '请求异常/风控，冷却 10 分钟后自动重试'
        : deliveryDetail.phase === 'stopping'
          ? '正在停止'
          : deliveryDetail.phase === 'failed'
            ? `详情采集失败: ${deliveryDetail.lastError || '未知异常'}`
            : deliveryDetail.phase === 'completed'
              ? '完整批次已处理完毕'
              : '等待任务启动'

  return (
    <div className="p-6 space-y-6 flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-black">
      {/* 1. Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 flex items-center justify-between transition-all duration-200 hover:border-primary/50 hover:shadow-sm">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              已采集商品数
            </p>
            <h3 className="text-2xl font-bold mt-1 text-primary">
              {metrics.totalCollected}{' '}
              <span className="text-xs font-normal text-muted-foreground">SKU</span>
            </h3>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <Database className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 flex items-center justify-between transition-all duration-200 hover:border-emerald-500/50 hover:shadow-sm">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              采集成功率
            </p>
            <h3 className="text-2xl font-bold mt-1 text-emerald-500 dark:text-emerald-400">
              {metrics.successRate}%
            </h3>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 flex items-center justify-between transition-all duration-200 hover:border-indigo-500/50 hover:shadow-sm">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              累计爬网时长
            </p>
            <h3 className="text-2xl font-bold mt-1 text-indigo-500 dark:text-indigo-400">
              {metrics.avgTime}
            </h3>
          </div>
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-500">
            <Cpu className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. 新建采集任务 (Full Width Control Bar at the top, Collapsible) */}
      <div className="bg-card text-card-foreground border border-border rounded-lg transition-all duration-200 hover:border-primary/20 hover:shadow-sm shrink-0">
        {/* Clickable Header */}
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
                {isCrawling
                  ? '采集引擎运行中，部分配置项已锁定'
                  : '配置亚马逊排行榜采集参数与多线程抓取策略'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
            {isCrawling ? (
              <div className="flex items-center space-x-1.5 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-blue-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping shrink-0" />
                <span>任务执行中</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 bg-slate-500/10 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-slate-500/10 dark:border-zinc-700">
                <span>就绪 (READY)</span>
              </div>
            )}

            <button
              onClick={() => setIsConfigExpanded(!isConfigExpanded)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors text-muted-foreground hover:text-foreground"
            >
              {isConfigExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {isConfigExpanded && (
          <div className="p-5 space-y-4 rounded-b-lg">
            {/* Row of Controls & Launch Button */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              {/* 采集任务类型 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  采集任务类型
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as CrawlTaskType)}
                  disabled={isCrawling || isFetchingCats || showAdjustModal}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all-200 cursor-pointer"
                >
                  {Object.values(CrawlTaskType).map((type) => (
                    <option key={type} value={type}>
                      {CrawlTaskTypeNames[type]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 目标站点 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  目标站点
                </label>
                <select
                  value={marketplace}
                  onChange={(e) => setMarketplace(e.target.value as AmazonMarketplace)}
                  disabled={isCrawling || isFetchingCats || showAdjustModal}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all-200 cursor-pointer"
                >
                  {Object.values(AmazonMarketplace).map((m) => (
                    <option key={m} value={m}>
                      {MarketplaceConfigs[m].name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 采集策略 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  采集策略
                </label>
                <select
                  value={crawlStrategy}
                  onChange={(e) => setCrawlStrategy(e.target.value as 'strategy1' | 'strategy2')}
                  disabled={isCrawling}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all-200 cursor-pointer"
                >
                  <option value="strategy1">实时并轨采集</option>
                  <option value="strategy2">延迟批量回填</option>
                </select>
              </div>

              {/* 操作控制按钮 */}
              <div>
                {!isCrawling ? (
                  <button
                    onClick={startCrawl}
                    disabled={isFetchingCats}
                    className="w-full inline-flex items-center justify-center space-x-2 bg-primary text-primary-foreground font-medium py-2 rounded-md hover:bg-primary/95 transition-all duration-150 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFetchingCats ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>获取分类中...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>开启亚马逊采集</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={stopCrawl}
                    disabled={isStopping}
                    className="w-full inline-flex items-center justify-center space-x-2 bg-destructive text-destructive-foreground font-medium py-2 rounded-md hover:bg-destructive/95 transition-all duration-150 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isStopping ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    <span>{isStopping ? '正在停止...' : '停止任务'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Dynamic Strategy Explanation (Adapted for full width) */}
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-border/65 rounded-md p-3.5">
              <h4 className="text-xs font-bold uppercase text-primary mb-1 flex items-center space-x-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span>
                  采集策略说明 - {crawlStrategy === 'strategy1' ? '实时并轨' : '延迟回填'}
                </span>
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {crawlStrategy === 'strategy1' ? (
                  <>
                    采用<b>实时并轨策略</b>
                    ：实时采集商品并获取商品详细信息。即：每抓取一页商品后，立即调用卖家精灵相关接口获取该页所有商品的详细信息然后存入数据库中。
                  </>
                ) : (
                  <>
                    采用<b>延迟回填策略</b>
                    ：先将排行榜中所有分类的商品都采集完成并存入数据库后，再调用卖家精灵相关接口获取所有商品的详细信息并更新数据库中的所有商品记录。
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Middle Row: Concurrency Grid & Live Logs Console (Side-by-Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-0 shrink-0">
        {/* Left Side: 详情并发采集进度 (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-card text-card-foreground border border-border rounded-lg p-6 flex flex-col transition-all duration-200 hover:border-primary/20 hover:shadow-sm overflow-visible justify-between h-[470px]">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <Grid className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-base">商品详情采集进度</h2>
              </div>
              <div className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                批次: {deliveryDetail.batchSize} | 并发: {deliveryDetail.concurrency}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
              系统从已采集排行中拉取商品列表，将以 <b>100 个商品 / 批次</b>{' '}
              启动高并发详情抓取，用于解析商品的“配送天数”。成功获取详细数据的商品方块将点亮并将数据存入数据库中。
            </p>

            {/* Grid Container with custom inline columns to override standard tailwind limits */}
            <div className="relative p-4 bg-slate-100/50 dark:bg-zinc-950/40 rounded-xl border border-border/80 mb-4 overflow-visible">
              <div
                className="grid gap-1 justify-center max-w-[320px] mx-auto overflow-visible"
                style={{ gridTemplateColumns: 'repeat(20, minmax(0, 1fr))' }}
              >
                {visibleCrawlQueue.map((item) => {
                  let statusBg =
                    'bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700'
                  if (item.status === 'success') {
                    statusBg =
                      'bg-primary hover:bg-primary/90 hover:scale-110 shadow-sm shadow-primary/30'
                  } else if (item.status === 'fetching') {
                    statusBg =
                      'bg-blue-500 dark:bg-blue-400 animate-pulse ring-2 ring-blue-400 dark:ring-blue-500 ring-offset-1 dark:ring-offset-black'
                  } else if (item.status === 'failed') {
                    statusBg =
                      'bg-rose-500 dark:bg-rose-600 hover:bg-rose-400 dark:hover:bg-rose-500 hover:scale-110 shadow-sm shadow-rose-500/30'
                  }

                  return (
                    <div
                      key={item.productId}
                      className={`w-2.5 h-2.5 rounded-sm transition-all duration-300 relative group cursor-pointer ${statusBg}`}
                    >
                      {/* Premium Custom Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2.5 hidden group-hover:block z-[9999] w-40 bg-slate-950 border border-zinc-800 text-white text-[10px] p-2 rounded shadow-2xl pointer-events-none transition-all duration-200">
                        <div className="font-semibold text-slate-200 flex justify-between border-b border-zinc-800 pb-1 mb-1">
                          <span>商品 #{Math.abs(item.productId)}</span>
                          <span
                            className={
                              item.status === 'success'
                                ? 'text-emerald-400 font-bold'
                                : item.status === 'failed'
                                  ? 'text-rose-400 font-bold'
                                  : item.status === 'fetching'
                                    ? 'text-blue-400 font-bold animate-pulse'
                                    : 'text-slate-400'
                            }
                          >
                            {item.status === 'success'
                              ? '采集成功'
                              : item.status === 'failed'
                                ? '失败'
                                : item.status === 'fetching'
                                  ? '并发中...'
                                  : '就绪等待'}
                          </span>
                        </div>
                        <p className="font-mono text-zinc-400 select-all">ASIN: {item.asin}</p>
                        {item.status === 'success' && (
                          <p className="text-emerald-400 mt-1 text-[9px] leading-tight border-t border-zinc-900 pt-1">
                            配送天数: {item.deliveryDays || '-'}
                          </p>
                        )}
                        {item.error && (
                          <p className="text-rose-400 mt-1 select-none text-[9px] leading-tight border-t border-zinc-900 pt-1">
                            ⚠️ {item.error}
                          </p>
                        )}
                        {/* Tooltip Arrow */}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-1.5 h-1.5 bg-slate-950 border-r border-b border-zinc-800 rotate-45"></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Scraper Grid Legend & Metrics (Pinned at the bottom of the card) */}
          <div className="space-y-3 bg-slate-50 dark:bg-zinc-900/30 p-3 rounded-lg border border-border/60 mt-4">
            {/* Legends Row */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground pb-2 border-b border-border/40">
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-sm bg-slate-200 dark:bg-zinc-800" />
                <span>就绪 ({pendingCount})</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-sm bg-blue-500 animate-pulse" />
                <span>并发中 ({fetchingCount})</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-sm bg-primary" />
                <span>成功 ({successCount})</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-sm bg-rose-500" />
                <span>失败 ({failedCount})</span>
              </div>
            </div>

            {/* Progress Bar & Simulator Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[11px] text-slate-600 dark:text-zinc-400">
                  当前批次完成度
                </span>
                <span className="font-bold text-primary">{completionPercentage}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1.5 text-[10px]">
                <span className="font-bold text-primary">{deliveryPhaseText}</span>
                <span className="text-muted-foreground">
                  累计成功 {deliveryDetail.totalSucceeded} | 失败 {deliveryDetail.totalFailed}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: 实时采集日志 (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-card text-card-foreground border border-border rounded-lg p-6 flex flex-col transition-all duration-200 hover:border-primary/20 hover:shadow-sm h-[470px]">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
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

          {/* Console Textarea Simulated Box */}
          <div
            ref={logsContainerRef}
            className="flex-1 bg-slate-950 dark:bg-black border border-border/80 rounded-md p-4 font-mono text-[11px] text-slate-300 overflow-y-auto flex flex-col space-y-1.5 h-0 min-h-[280px]"
          >
            {logs.map((log, index) => {
              let color = 'text-slate-300'
              if (
                log.startsWith('[成功]') ||
                log.includes('✅') ||
                log.includes('🎉') ||
                log.includes('[模拟进度]')
              )
                color = 'text-emerald-400 font-semibold'
              if (log.startsWith('[警告]')) color = 'text-amber-400 font-semibold'
              if (
                log.startsWith('[开始]') ||
                log.startsWith('[参数]') ||
                log.startsWith('[连接]') ||
                log.startsWith('[首级]') ||
                log.startsWith('[回溯]') ||
                log.startsWith('[系统]')
              )
                color = 'text-sky-400'
              if (log.startsWith('[终止]') || log.startsWith('[错误]')) color = 'text-rose-400'
              if (log.startsWith('[数据]')) color = 'text-indigo-400'
              if (log.includes('➡️')) color = 'text-white font-bold'
              return (
                <div key={index} className={`whitespace-pre-wrap leading-relaxed ${color}`}>
                  {log}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 4. 实时采集拓扑图 (Full Width Panel at the bottom) */}
      <div className="bg-card text-card-foreground border border-border rounded-lg transition-all duration-200 hover:border-primary/20 hover:shadow-sm w-full shrink-0">
        {/* Header Bar */}
        <div
          onClick={() => setIsPanelExpanded(!isPanelExpanded)}
          className="flex items-center justify-between p-4 cursor-pointer select-none border-b border-border/60 hover:bg-slate-100/30 dark:hover:bg-zinc-900/30 transition-colors rounded-t-lg"
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded bg-primary/10 text-primary">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">实时采集拓扑图</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isStopping
                  ? `正在停止任务 | 等待当前请求退出 | 当前路径深度: ${activePath.length} 层`
                  : isCrawling
                    ? `深度递归挖掘中 | 当前路径深度: ${activePath.length} 层`
                    : '后台处于就绪状态，等待任务开启'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
            {isStopping ? (
              <div className="flex items-center space-x-1.5 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/20 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span>停止中 (STOPPING)</span>
              </div>
            ) : isCrawling ? (
              <div className="flex items-center space-x-1.5 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-blue-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping shrink-0" />
                <span>采集中 (DFS ACTIVE)</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 bg-slate-500/10 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-slate-500/10 dark:border-zinc-700">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-500 shrink-0" />
                <span>空闲 (IDLE)</span>
              </div>
            )}

            <button
              onClick={() => setIsPanelExpanded(!isPanelExpanded)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors text-muted-foreground hover:text-foreground"
            >
              {isPanelExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Panel Content */}
        {isPanelExpanded && (
          <div className="p-5 min-h-[180px] max-h-[300px] overflow-hidden flex flex-col justify-center bg-slate-50/30 dark:bg-zinc-950/20 rounded-b-lg">
            <style
              dangerouslySetInnerHTML={{
                __html: `
              @keyframes scan-line {
                0% { transform: translateY(-100%); }
                100% { transform: translateY(300%); }
              }
              .scan-effect::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 40px;
                background: linear-gradient(to bottom, transparent, rgba(59, 130, 246, 0.08), transparent);
                animation: scan-line 2.5s linear infinite;
                pointer-events: none;
              }
              .dark .scan-effect::after {
                background: linear-gradient(to bottom, transparent, rgba(59, 130, 246, 0.15), transparent);
              }
            `
              }}
            />

            {firstLevelCats.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="p-3 bg-slate-100 dark:bg-zinc-900 border border-border rounded-full text-muted-foreground animate-bounce">
                  <Activity className="w-5 h-5 text-muted-foreground/60 animate-pulse" />
                </div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 mt-3">
                  等待采集任务启动以绘制实时拓扑图
                </h4>
                <p className="text-[11px] text-muted-foreground max-w-sm mt-1">
                  启动亚马逊排行榜采集后，系统将在此处自动加载首级所有分类列表，并随深度遍历算法实时向下渲染当前正在解析的子分类链路。
                </p>
              </div>
            ) : (
              /* Topology Tree View */
              <div className="flex flex-row items-stretch gap-6 h-[200px] overflow-hidden">
                {/* Column 1: 一级分类 (Root Categories) */}
                <div className="w-64 flex flex-col border-r border-border/60 pr-4 shrink-0">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      一级分类 (Root)
                    </span>
                    <span className="text-[9px] bg-slate-100 dark:bg-zinc-800 text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                      已完结 {completedPrimaries.length}/{firstLevelCats.length}
                    </span>
                  </div>

                  {/* Scrollable Root Cats Stack */}
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 scrollbar-thin">
                    {firstLevelCats.map((catName) => {
                      const isCompleted = completedPrimaries.includes(catName)
                      const isActive = activePath[0]?.name === catName

                      let cardStyle =
                        'bg-slate-100/50 dark:bg-zinc-900/40 border-border text-muted-foreground hover:border-border/80'
                      let iconEl = (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-600 shrink-0" />
                      )

                      if (isCompleted) {
                        cardStyle =
                          'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold'
                        iconEl = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      } else if (isActive) {
                        cardStyle =
                          'bg-primary/5 border-primary text-primary font-bold shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                        iconEl = (
                          <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                        )
                      }

                      return (
                        <div
                          key={catName}
                          className={`flex items-center justify-between px-3 py-2 rounded border text-xs gap-2 transition-all duration-200 select-none ${cardStyle}`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            {iconEl}
                            <span className="truncate" title={catName}>
                              {catName}
                            </span>
                          </div>
                          {isActive && (
                            <span className="text-[9px] bg-primary/20 text-primary px-1 rounded animate-pulse shrink-0 font-medium">
                              活动中
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Column 2+: DFS Active Crawling Subcategories Path */}
                <div className="flex-1 flex flex-row items-center gap-4 pl-2 overflow-x-auto">
                  {activePath.length <= 1 ? (
                    /* Initializing / Fetching first level */
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-4 bg-slate-500/5 rounded-md border border-border border-dashed h-full">
                      <Loader2 className="w-5 h-5 text-primary animate-spin mb-2" />
                      <h5 className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                        正在抓取一级分类根节点...
                      </h5>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        正在发起网络请求，载入首级排行榜并向下发掘子分类
                      </p>
                    </div>
                  ) : (
                    /* Active subcategories cards flow */
                    activePath.slice(1).map((subNode, idx) => {
                      const nodeLevel = idx + 2

                      return (
                        <React.Fragment key={subNode.name}>
                          {/* Connector Arrow */}
                          <div className="flex flex-col items-center justify-center shrink-0">
                            <ArrowRight className="w-4 h-4 text-primary animate-pulse" />
                            <span className="text-[8px] text-primary/60 font-mono mt-0.5">DFS</span>
                          </div>

                          {/* Node Card */}
                          <div className="relative overflow-hidden w-44 bg-primary/5 dark:bg-primary/10 border border-primary text-foreground rounded-lg p-3.5 flex flex-col shrink-0 justify-between h-[120px] transition-all hover:scale-[1.02] shadow-[0_0_12px_rgba(59,130,246,0.1)] scan-effect">
                            <div>
                              {/* Top Level Indicator Tag */}
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono uppercase tracking-wider font-semibold">
                                  LEVEL {nodeLevel}
                                </span>
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                              </div>

                              {/* Subcategory Name */}
                              <h4
                                className="font-bold text-xs mt-2 text-slate-800 dark:text-zinc-200 line-clamp-2 leading-snug"
                                title={subNode.name}
                              >
                                {subNode.name}
                              </h4>
                            </div>

                            {/* Live Task Description */}
                            <div className="mt-2 pt-2 border-t border-primary/20 flex items-center justify-between text-[9px] text-primary font-medium">
                              <span className="animate-pulse">
                                {idx === activePath.slice(1).length - 1
                                  ? '📥 深度探针爬取中...'
                                  : '🔄 递归嵌套向下...'}
                              </span>
                              <span className="text-muted-foreground font-mono">
                                D{subNode.depth}
                              </span>
                            </div>
                          </div>
                        </React.Fragment>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Custom Category Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden">
          {/* Backdrop Blur Overlay */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
            onClick={cancelCrawlPreparation}
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-4xl bg-white/90 dark:bg-zinc-950/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl shadow-2xl shadow-primary/10 overflow-hidden flex flex-col h-[85vh] max-h-[700px] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-border/60 shrink-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Grid className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">自定义采集分类</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      本次任务仅对勾选的分类进行商品采集。您可以拖动卡片进行排序，调整采集的优先级。
                    </p>
                  </div>
                </div>
                <button
                  onClick={cancelCrawlPreparation}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Quick Actions Toolbar */}
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllCategories}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold rounded-lg text-slate-700 dark:text-zinc-300 transition-colors"
                  >
                    全选
                  </button>
                  <button
                    onClick={deselectAllCategories}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold rounded-lg text-slate-700 dark:text-zinc-300 transition-colors"
                  >
                    全不选
                  </button>
                  <button
                    onClick={restoreDefaultCategories}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold rounded-lg text-slate-700 dark:text-zinc-300 transition-colors flex items-center space-x-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>恢复默认</span>
                  </button>
                </div>

                {/* Stats */}
                <div className="text-xs text-muted-foreground">
                  已启用分类:{' '}
                  <span className="font-bold text-primary">
                    {tempCategories.filter((c) => c.enabled).length}
                  </span>{' '}
                  / {tempCategories.length}
                </div>
              </div>
            </div>

            {/* Scrollable Category Grid */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-black/20 scrollbar-thin">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {tempCategories.map((cat, idx) => {
                  const isDragSource = draggedIndex === idx
                  const idxStr = String(idx + 1).padStart(2, '0')

                  return (
                    <div
                      key={cat.name}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`
                        group flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 cursor-grab select-none
                        ${
                          cat.enabled
                            ? 'bg-card text-card-foreground border-border/80 hover:border-primary/40 hover:shadow-sm'
                            : 'bg-slate-100/50 dark:bg-zinc-900/20 border-border/40 text-muted-foreground opacity-60'
                        }
                        ${isDragSource ? 'border-dashed border-primary bg-primary/5 opacity-50 scale-[0.98]' : ''}
                      `}
                    >
                      <div className="flex items-center space-x-3.5 truncate">
                        {/* Drag Handle */}
                        <div className="text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors shrink-0">
                          <svg
                            className="w-4 h-4 cursor-move"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M4 6h16M4 12h16M4 18h16"
                            />
                          </svg>
                        </div>

                        {/* Index Badge */}
                        <span
                          className={`
                          font-mono text-xs font-bold px-1.5 py-0.5 rounded-md shrink-0
                          ${
                            cat.enabled
                              ? 'bg-primary/10 text-primary'
                              : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600'
                          }
                        `}
                        >
                          {idxStr}
                        </span>

                        {/* Category Name */}
                        <span
                          className="font-semibold text-xs truncate text-slate-800 dark:text-zinc-200"
                          title={cat.name}
                        >
                          {cat.name}
                        </span>
                      </div>

                      {/* Enable Switch Toggle */}
                      <div
                        onClick={() => toggleCategory(idx)}
                        className="cursor-pointer p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                      >
                        {cat.enabled ? (
                          <div className="flex items-center space-x-1.5 text-primary text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            <span>已启用</span>
                            <div className="w-4 h-4 flex items-center justify-center bg-primary text-primary-foreground rounded-sm">
                              <CheckCircle2 className="w-3 h-3" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5 text-muted-foreground text-[10px]">
                            <span>已禁用</span>
                            <div className="w-4 h-4 border border-slate-300 dark:border-zinc-700 rounded-sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-border/60 bg-slate-50 dark:bg-zinc-950/40 shrink-0 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground italic">
                提示: 可以按住分类卡片左侧手柄拖动调整抓取顺序
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={cancelCrawlPreparation}
                  className="px-4 py-2 border border-border bg-background hover:bg-slate-100 dark:hover:bg-zinc-900 font-semibold text-xs rounded-lg text-slate-700 dark:text-zinc-300 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmAndStartCrawl}
                  disabled={tempCategories.filter((c) => c.enabled).length === 0}
                  className="px-5 py-2 bg-primary hover:bg-primary/95 font-semibold text-xs rounded-lg text-primary-foreground hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>确认并开启采集</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default AmazonCollection
