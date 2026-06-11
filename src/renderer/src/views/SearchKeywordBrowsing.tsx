import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ExternalLink,
  ImageIcon,
  Inbox,
  Layers3,
  Loader2,
  RefreshCw,
  Search,
  Tags,
  X,
  Database,
  SlidersHorizontal
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import type { SharedDataSource } from '../../../shared/data-sharing'
import { AMAZON_SEARCH_TASK_TYPE } from '../../../shared/amazon-search'

const LOCAL_DATA_SOURCE_ID = 'local'

interface CrawlTask {
  id: number
  task_name: string
  task_type: string
  marketplace: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  created_at: string
  completed_at?: string
}

interface SearchKeywordRow {
  id: number
  task_id: number
  keyword: string
  keyword_image_url?: string | null
  first_product_image_url?: string | null
  matched_product_count: number
  linked_product_count: number
  is_read: 0 | 1
  created_at: string
  marketplace: string
}

interface SearchKeywordProduct {
  id: number
  task_id: number
  asin: string
  title: string
  currency: string
  price_amount: number
  original_price?: string | null
  image_url: string
  product_url: string
  category_name: string
  seller_type?: string | null
  sellersprite_units?: number | null
  sellersprite_available?: number | null
  delivery_days?: string | null
  delivery_text?: string | null
  keyword_delivery_days?: number | null
}

function isSearchKeywordTask(task: CrawlTask): boolean {
  return task.task_type === AMAZON_SEARCH_TASK_TYPE
}

function marketplaceBaseUrl(marketplace: string): string {
  if (marketplace === 'US') return 'https://www.amazon.com'
  if (marketplace === 'UK') return 'https://www.amazon.co.uk'
  if (marketplace === 'DE') return 'https://www.amazon.de'
  return 'https://www.amazon.co.jp'
}

function buildSearchUrl(keyword: SearchKeywordRow): string {
  const url = new URL('/s', marketplaceBaseUrl(keyword.marketplace))
  url.searchParams.set('k', keyword.keyword)
  url.searchParams.set('language', 'zh_CN')
  return url.href
}

function formatPrice(amount: number, currency: string): string {
  if (!amount) return '未标价'

  const upperCurrency = currency.toUpperCase()
  if (upperCurrency === 'JPY') return `¥${Math.round(amount).toLocaleString()}`
  if (upperCurrency === 'USD') return `$${amount.toFixed(2)}`
  if (upperCurrency === 'GBP') return `£${amount.toFixed(2)}`
  if (upperCurrency === 'EUR') return `€${amount.toFixed(2)}`
  return `${currency} ${amount.toLocaleString()}`
}

function formatDate(isoStr: string): string {
  if (!isoStr) return '-'
  const date = new Date(isoStr)
  if (Number.isNaN(date.getTime())) return isoStr

  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatAvailableDays(timestamp?: number | null): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '-'

  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000))
  return `${days}天${days <= 90 ? ' · 新品' : ''}`
}

export const SearchKeywordBrowsing: React.FC = () => {
  const activeTab = useAppStore((state) => state.activeTab)
  const [selectedDataSource, setSelectedDataSource] = useState(LOCAL_DATA_SOURCE_ID)
  const [remoteDataSources, setRemoteDataSources] = useState<SharedDataSource[]>([])
  const [isSourceRefreshing, setIsSourceRefreshing] = useState(false)
  const [isManualSourceConnecting, setIsManualSourceConnecting] = useState(false)
  const [manualSourceAddress, setManualSourceAddress] = useState('')
  const [dataSourceError, setDataSourceError] = useState('')
  const [tasks, setTasks] = useState<CrawlTask[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<number | ''>('')
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(40)
  const [totalCount, setTotalCount] = useState(0)
  const [keywords, setKeywords] = useState<SearchKeywordRow[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false)
  const [activeKeyword, setActiveKeyword] = useState<SearchKeywordRow | null>(null)
  const [activeKeywordProducts, setActiveKeywordProducts] = useState<SearchKeywordProduct[]>([])
  const [isLoadingKeywordProducts, setIsLoadingKeywordProducts] = useState(false)

  const selectedRemoteDataSource = useMemo(
    () => remoteDataSources.find((source) => source.id === selectedDataSource) || null,
    [remoteDataSources, selectedDataSource]
  )
  const isLocalDataSource = selectedDataSource === LOCAL_DATA_SOURCE_ID
  const totalPages = Math.ceil(totalCount / pageSize) || 1

  const handleRefreshSource = async (): Promise<void> => {
    setIsSourceRefreshing(true)
    setDataSourceError('')

    try {
      const sources = await window.api.dataSharing.discoverSources()
      setRemoteDataSources(sources)
      if (
        selectedDataSource !== LOCAL_DATA_SOURCE_ID &&
        !sources.some((source) => source.id === selectedDataSource)
      ) {
        setSelectedDataSource(LOCAL_DATA_SOURCE_ID)
      }
    } catch (error) {
      setDataSourceError(error instanceof Error ? error.message : '扫描局域网数据源失败。')
    } finally {
      setIsSourceRefreshing(false)
    }
  }

  const handleConnectManualSource = async (): Promise<void> => {
    const [host, portText] = manualSourceAddress.trim().split(':')
    const port = Number(portText || '48991')
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
      setDataSourceError('请输入正确的数据源地址，例如 192.168.1.23:48991。')
      return
    }

    setIsManualSourceConnecting(true)
    setDataSourceError('')

    try {
      const source = await window.api.dataSharing.connectManualSource(host, port)
      setRemoteDataSources((currentSources) => [
        source,
        ...currentSources.filter((currentSource) => currentSource.id !== source.id)
      ])
      setSelectedDataSource(source.id)
    } catch (error) {
      setDataSourceError(error instanceof Error ? error.message : '连接数据源失败。')
    } finally {
      setIsManualSourceConnecting(false)
    }
  }

  const fetchTasks = async (keepSelection = false): Promise<void> => {
    setIsLoadingTasks(true)
    try {
      const list = isLocalDataSource
        ? await window.electron.ipcRenderer
            .invoke('db:get-tasks')
            .then((res) => (res.success && res.list ? (res.list as CrawlTask[]) : []))
        : selectedRemoteDataSource
          ? ((await window.api.dataSharing.getRemoteTasks(selectedRemoteDataSource)) as CrawlTask[])
          : []
      const searchTasks = list.filter(isSearchKeywordTask)

      setTasks(searchTasks)
      if (searchTasks.length > 0) {
        const exists = searchTasks.some((task) => task.id === selectedTaskId)
        if (!keepSelection || !selectedTaskId || !exists) {
          setSelectedTaskId(searchTasks[0].id)
        }
      } else {
        setSelectedTaskId('')
      }
    } catch (error) {
      console.error('[SearchKeywordBrowsing] 获取搜索词任务失败:', error)
      setTasks([])
      setSelectedTaskId('')
    } finally {
      setIsLoadingTasks(false)
    }
  }

  const fetchKeywords = async (): Promise<void> => {
    if (!selectedTaskId) return

    setIsLoadingKeywords(true)
    try {
      const filter = {
        taskId: selectedTaskId,
        sortBy: 'created_at',
        sortOrder,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize
      }
      const res = isLocalDataSource
        ? await window.electron.ipcRenderer.invoke('db:query-search-keywords', filter)
        : selectedRemoteDataSource
          ? {
              success: true,
              ...(await window.api.dataSharing.queryRemoteSearchKeywords(
                selectedRemoteDataSource,
                filter
              ))
            }
          : { success: false }

      if (res.success) {
        setKeywords((res.list || []) as SearchKeywordRow[])
        setTotalCount(res.total || 0)
      } else {
        setKeywords([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error('[SearchKeywordBrowsing] 查询搜索词失败:', error)
      setKeywords([])
      setTotalCount(0)
    } finally {
      setIsLoadingKeywords(false)
    }
  }

  const fetchKeywordProducts = async (keyword: SearchKeywordRow): Promise<void> => {
    setActiveKeyword({ ...keyword, is_read: 1 })
    setKeywords((currentKeywords) =>
      currentKeywords.map((item) => (item.id === keyword.id ? { ...item, is_read: 1 } : item))
    )
    setIsLoadingKeywordProducts(true)
    setActiveKeywordProducts([])

    try {
      const list = isLocalDataSource
        ? await window.electron.ipcRenderer
            .invoke('db:get-search-keyword-products', keyword.id)
            .then((res) => (res.success && res.list ? res.list : []))
        : selectedRemoteDataSource
          ? await window.api.dataSharing.getRemoteSearchKeywordProducts(
              selectedRemoteDataSource,
              keyword.id
            )
          : []

      setActiveKeywordProducts(list as SearchKeywordProduct[])
      try {
        if (isLocalDataSource) {
          await window.electron.ipcRenderer.invoke('db:mark-search-keyword-read', keyword.id)
        } else if (selectedRemoteDataSource) {
          await window.api.dataSharing.markRemoteSearchKeywordAsRead(
            selectedRemoteDataSource,
            keyword.id
          )
        }
      } catch (error) {
        console.error('[SearchKeywordBrowsing] 更新搜索词已读状态失败:', error)
      }
    } catch (error) {
      console.error('[SearchKeywordBrowsing] 获取搜索词商品失败:', error)
      setActiveKeywordProducts([])
    } finally {
      setIsLoadingKeywordProducts(false)
    }
  }

  const handleRefreshAll = async (): Promise<void> => {
    if (!selectedTaskId) {
      await fetchTasks(false)
      return
    }

    await fetchTasks(true)
    await fetchKeywords()
  }

  useEffect(() => {
    if (activeTab === 'search-keyword-browsing') {
      void fetchTasks()
    }
  }, [activeTab])

  useEffect(() => {
    setSelectedTaskId('')
    setTasks([])
    setKeywords([])
    setTotalCount(0)
    setCurrentPage(1)
    setActiveKeyword(null)
    setActiveKeywordProducts([])
    if (activeTab === 'search-keyword-browsing') {
      void fetchTasks()
    }
  }, [selectedDataSource, activeTab])

  useEffect(() => {
    if (!selectedTaskId) {
      setKeywords([])
      setTotalCount(0)
      return
    }

    setCurrentPage(1)
  }, [selectedTaskId, selectedDataSource])

  useEffect(() => {
    void fetchKeywords()
  }, [selectedTaskId, sortOrder, currentPage, selectedDataSource])

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto bg-slate-50 dark:bg-black pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-primary/10 text-primary rounded">
              <Tags className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-foreground">搜索词数据浏览</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            按搜索词任务浏览符合条件商品对应的搜索词集合
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://zying.woc.cool"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-1 border border-primary/25 bg-primary/10 text-xs font-semibold py-1.5 px-3 rounded-md hover:bg-primary/15 text-primary transition-all duration-200"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>在浏览器中浏览</span>
          </a>
          <button
            onClick={handleRefreshAll}
            className="inline-flex items-center space-x-1 border border-border bg-card text-xs font-semibold py-1.5 px-3 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200"
            disabled={isLoadingTasks || isLoadingKeywords}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingTasks || isLoadingKeywords ? 'animate-spin' : ''}`}
            />
            <span>刷新任务</span>
          </button>
        </div>
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-sm transition-all duration-200 hover:border-primary/20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Data Source Config */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-border/60">
              <Database className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                数据源配置
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 选择数据源 */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  选择数据源
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedDataSource}
                    onChange={(event) => setSelectedDataSource(event.target.value)}
                    className="flex-1 bg-background border border-border rounded-md px-3.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 font-semibold"
                  >
                    <option value={LOCAL_DATA_SOURCE_ID}>本地数据</option>
                    {remoteDataSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name} ({source.host}:{source.port})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleRefreshSource}
                    disabled={isSourceRefreshing}
                    className="p-2 border border-border rounded-md bg-card hover:bg-slate-100 dark:hover:bg-zinc-900 text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-50"
                    title="刷新数据源"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isSourceRefreshing ? 'animate-spin text-primary' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* 手动局域网连接 */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  手动局域网连接
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={manualSourceAddress}
                    onChange={(event) => setManualSourceAddress(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void handleConnectManualSource()
                      }
                    }}
                    placeholder="手动连接 IP:端口"
                    className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => void handleConnectManualSource()}
                    disabled={isManualSourceConnecting}
                    className="px-3 py-1.5 border border-border rounded-md bg-card hover:bg-slate-100 dark:hover:bg-zinc-900 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-50"
                  >
                    {isManualSourceConnecting ? '连接中' : '连接'}
                  </button>
                </div>
              </div>
            </div>

            {dataSourceError && (
              <div className="text-xs font-semibold text-rose-500 mt-1 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{dataSourceError}</span>
              </div>
            )}
          </div>

          {/* Right Column: Task Selection & Stats */}
          <div className="lg:col-span-5 flex flex-col space-y-4 justify-between lg:pl-6 lg:border-l lg:border-border/60">
            <div className="flex items-center space-x-2 pb-2 border-b border-border/60">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                选择任务标识
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-4 flex-1">
              <div className="flex-1 space-y-1.5 min-w-0 flex flex-col justify-center">
                <select
                  value={selectedTaskId}
                  onChange={(event) =>
                    setSelectedTaskId(event.target.value ? Number(event.target.value) : '')
                  }
                  className="w-full bg-background border border-border rounded-md px-3.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 font-semibold"
                  disabled={isLoadingTasks}
                >
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.task_name} (任务 ID: {task.id} | {task.marketplace})
                    </option>
                  ))}
                  {tasks.length === 0 && !isLoadingTasks && (
                    <option value="">-- 当前尚无搜索词采集任务 --</option>
                  )}
                </select>
              </div>

              {/* Divider for small screen stats */}
              <div className="hidden sm:block w-px bg-border/60 self-stretch my-1" />

              <div className="flex flex-col justify-center min-w-[120px] text-left sm:text-right shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  当前搜索词数
                </span>
                <p className="text-base font-black text-primary mt-1 whitespace-nowrap">
                  {totalCount} 个
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {tasks.length === 0 && !isLoadingTasks ? (
        <div className="bg-card border border-border rounded-lg p-16 text-center shadow-sm flex flex-col items-center justify-center space-y-4 min-h-[400px]">
          <div className="p-5 bg-primary/5 text-primary/40 rounded-full">
            <Inbox className="w-12 h-12" />
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="text-lg font-bold text-foreground">暂无搜索词采集任务</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              请先在“亚马逊搜索词”页面完成一次搜索词采集，随后即可在这里查看搜索词和对应商品。
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-sm space-y-4 transition-all duration-200 hover:border-primary/20">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold">排序设置</h4>
              </div>
              <button
                onClick={() => {
                  setSortOrder('DESC')
                  setCurrentPage(1)
                }}
                className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
              >
                恢复默认排序
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block">排序字段</label>
                <select
                  value="created_at"
                  disabled
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none transition-all duration-200 opacity-80"
                >
                  <option value="created_at">采集入库时间</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block">排序方向</label>
                <select
                  value={sortOrder}
                  onChange={(event) => {
                    setSortOrder(event.target.value as 'ASC' | 'DESC')
                    setCurrentPage(1)
                  }}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                >
                  <option value="DESC">降序排列（最新优先）</option>
                  <option value="ASC">升序排列（最早优先）</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-card text-card-foreground border border-border rounded-lg p-6 shadow-sm flex flex-col justify-between transition-all duration-200 hover:border-primary/20 min-h-[400px] relative">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                <h3 className="font-bold text-base">搜索词列表</h3>
              </div>
              <span className="text-xs text-muted-foreground">已加载 {keywords.length} 条</span>
            </div>

            <div className="relative overflow-x-auto rounded-md border border-border">
              {isLoadingKeywords && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs text-primary font-bold">正在读取搜索词数据...</p>
                </div>
              )}
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-slate-50 dark:bg-slate-900/50 text-xs font-bold text-muted-foreground uppercase">
                    <th className="py-3.5 px-4 font-bold text-center w-24">图片</th>
                    <th className="py-3.5 px-4 font-bold min-w-[260px]">搜索词</th>
                    <th className="py-3.5 px-4 font-bold text-center w-36">符合商品数量</th>
                    <th className="py-3.5 px-4 font-bold text-center w-32">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {keywords.length > 0 ? (
                    keywords.map((keyword) => (
                      <tr
                        key={keyword.id}
                        className={`transition-colors ${
                          keyword.is_read
                            ? 'bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15'
                            : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/20'
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          <div className="relative inline-flex w-14 h-14 rounded-lg border border-border bg-muted overflow-hidden items-center justify-center">
                            {keyword.first_product_image_url ? (
                              <img
                                src={keyword.first_product_image_url}
                                alt={keyword.keyword}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => void fetchKeywordProducts(keyword)}
                            className="font-bold text-foreground hover:text-primary hover:underline text-left"
                          >
                            {keyword.keyword}
                          </button>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            入库时间：{formatDate(keyword.created_at)}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-black">
                            {keyword.linked_product_count || keyword.matched_product_count} 个
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => void fetchKeywordProducts(keyword)}
                              className="px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors font-semibold"
                            >
                              商品
                            </button>
                            <a
                              href={buildSearchUrl(keyword)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 border border-border rounded text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all"
                              title="打开 Amazon 搜索结果"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <AlertCircle className="w-7 h-7 text-muted-foreground/45" />
                          <p className="font-bold">未找到任何搜索词</p>
                          <p className="text-2xs text-muted-foreground max-w-xs">
                            当前任务暂无搜索词数据，请刷新任务或等待采集完成。
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 mt-6 gap-4">
              <span className="text-xs text-muted-foreground font-semibold">
                显示第 {keywords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} 至{' '}
                {Math.min(currentPage * pageSize, totalCount)} 条搜索词，共 {totalCount} 条
              </span>
              <div className="inline-flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 border border-border rounded text-2xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                  首页
                </button>
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-border rounded text-2xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                  上一页
                </button>
                <span className="text-2xs font-extrabold px-3 py-1 bg-primary/10 text-primary border border-primary/25 rounded">
                  第 {currentPage} 页 / 共 {totalPages} 页
                </span>
                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-border rounded text-2xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                  下一页
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 border border-border rounded text-2xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                  末页
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {activeKeyword && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActiveKeyword(null)}
        >
          <div
            className="bg-card text-card-foreground border border-border rounded-2xl max-w-6xl w-full p-5 shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 cursor-default"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <Layers3 className="w-4 h-4 text-primary" />
                  <h4 className="font-extrabold text-base text-foreground">
                    {activeKeyword.keyword}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  共 {activeKeywordProducts.length} 个关联商品，点击卡片可打开 Amazon 商品页
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={buildSearchUrl(activeKeyword)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/95 transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                  打开搜索结果页
                </a>
                <button
                  onClick={() => setActiveKeyword(null)}
                  className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto pt-5 pr-1">
              {isLoadingKeywordProducts ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-primary">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-xs font-bold">正在读取关联商品...</p>
                </div>
              ) : activeKeywordProducts.length > 0 ? (
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [column-fill:_balance]">
                  {activeKeywordProducts.map((product) => (
                    <a
                      key={product.id}
                      href={product.product_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-4 inline-block w-full break-inside-avoid rounded-2xl border border-border bg-background overflow-hidden hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30 transition-all"
                    >
                      <div className="bg-muted">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.title}
                            className="w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-40 flex items-center justify-center text-muted-foreground/40">
                            <ImageIcon className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        <h5 className="text-xs font-bold text-foreground leading-relaxed line-clamp-3">
                          {product.title || product.asin}
                        </h5>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                          <InfoPill label="配送方式" value={product.seller_type || '-'} />
                          <InfoPill
                            label="配送天数"
                            value={
                              product.keyword_delivery_days !== undefined &&
                              product.keyword_delivery_days !== null
                                ? `${product.keyword_delivery_days}天`
                                : product.delivery_days || '-'
                            }
                          />
                          <InfoPill
                            label="上架时间"
                            value={formatAvailableDays(product.sellersprite_available)}
                          />
                          <InfoPill
                            label="月销量"
                            value={
                              product.sellersprite_units !== undefined &&
                              product.sellersprite_units !== null
                                ? `${product.sellersprite_units.toLocaleString()}件`
                                : '-'
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-sm font-black text-primary">
                            {formatPrice(product.price_amount, product.currency)}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Inbox className="w-10 h-10 opacity-40" />
                  <p className="text-sm font-bold">该搜索词暂无关联商品数据</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-lg bg-muted/60 px-2 py-1">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="font-bold text-foreground truncate">{value}</p>
    </div>
  )
}

export default SearchKeywordBrowsing
