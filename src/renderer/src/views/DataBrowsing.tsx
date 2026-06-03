import React, { useState, useEffect, useMemo } from 'react'
import {
  Search,
  SlidersHorizontal,
  ExternalLink,
  Loader2,
  Database,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Inbox,
  Sparkles,
  Award
} from 'lucide-react'
import { useAppStore } from '../store/appStore'

// 采集任务接口定义
interface CrawlTask {
  id: number
  task_name: string
  task_type: string
  marketplace: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  created_at: string
  completed_at?: string
}

// 采集商品接口定义
interface CrawledProduct {
  id: number
  task_id: number
  asin: string
  rank: number
  title: string
  currency: string
  price_amount: number
  original_price?: string
  image_url: string
  product_url: string
  category_name: string
  seller_type?: string | null
  sellersprite_units?: number | null
  sellersprite_available?: number | null
  delivery_days?: string | null
  has_delivery_detail: 0 | 1
  crawled_at: string
}

// 分类层级树节点定义
interface CategoryNode {
  name: string
  fullPath: string
  children: Map<string, CategoryNode>
}

export const DataBrowsing: React.FC = () => {
  // 核心状态变量
  const activeTab = useAppStore((state) => state.activeTab)
  const [selectedDataSource, setSelectedDataSource] = useState('local')
  const [isSourceRefreshing, setIsSourceRefreshing] = useState(false)

  const handleRefreshSource = () => {
    setIsSourceRefreshing(true)
    setTimeout(() => setIsSourceRefreshing(false), 850)
  }

  const [tasks, setTasks] = useState<CrawlTask[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<number | ''>('')
  const [categories, setCategories] = useState<string[]>([])
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]) // 级联选中的分类段，例如 ['洋書', '文学']
  const [sellerTypes, setSellerTypes] = useState<string[]>([])
  const [selectedSellerType, setSelectedSellerType] = useState<string>('')

  // 过滤与排序
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<string>('rank') // 默认按照排名排序
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC')

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20) // 💡 用户要求一页显示20条
  const [totalCount, setTotalCount] = useState(0)
  const [products, setProducts] = useState<CrawledProduct[]>([])

  // 全局交互状态
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [copiedAsin, setCopiedAsin] = useState<string | null>(null)

  // 详情模态框状态
  const [activeProductDetail, setActiveProductDetail] = useState<CrawledProduct | null>(null)
  const [bsrRanks, setBsrRanks] = useState<any[]>([])
  const [isLoadingBsr, setIsLoadingBsr] = useState(false)

  // 当查看商品详情时，自动加载其关联的 BSR 榜单排名记录
  useEffect(() => {
    if (!activeProductDetail) {
      setBsrRanks([])
      return
    }

    const fetchBsrRanks = async () => {
      setIsLoadingBsr(true)
      try {
        const res = await window.electron.ipcRenderer.invoke(
          'db:get-product-bsr-ranks',
          activeProductDetail.id
        )
        if (res.success && res.list) {
          setBsrRanks(res.list)
        } else {
          setBsrRanks([])
        }
      } catch (err) {
        console.error('[DataBrowsing] 获取商品 BSR 排名失败:', err)
        setBsrRanks([])
      } finally {
        setIsLoadingBsr(false)
      }
    }

    fetchBsrRanks()
  }, [activeProductDetail])

  // 💡 刷新全部任务相关的数据（当前选中的任务数据、商品数、分类、配送方式、列表等）
  const handleRefreshAll = async () => {
    if (!selectedTaskId) {
      await fetchTasks(false)
      return
    }

    await fetchTasks(true)
    await fetchCategories(selectedTaskId)
    await fetchSellerTypes(selectedTaskId)
    await fetchProducts()
  }

  // 1. 获取所有任务列表
  const fetchTasks = async (keepSelection = false) => {
    setIsLoadingTasks(true)
    try {
      const res = await window.electron.ipcRenderer.invoke('db:get-tasks')
      if (res.success && res.list) {
        setTasks(res.list)
        if (res.list.length > 0) {
          const exists = res.list.some((task) => task.id === selectedTaskId)
          if (!keepSelection || !selectedTaskId || !exists) {
            setSelectedTaskId(res.list[0].id)
          }
        } else {
          setSelectedTaskId('')
        }
      }
    } catch (err) {
      console.error('[DataBrowsing] 获取采集任务列表失败:', err)
    } finally {
      setIsLoadingTasks(false)
    }
  }

  // 1. 监听全局活动 Tab 状态，当用户切入“数据浏览”页面时，自动刷新最新的任务列表
  useEffect(() => {
    if (activeTab === 'data-browsing') {
      fetchTasks()
    }
  }, [activeTab])

  // 核心获取状态的异步函数
  const fetchCategories = async (taskId: number) => {
    try {
      const res = await window.electron.ipcRenderer.invoke('db:get-categories', taskId)
      if (res.success && res.list) {
        setCategories(res.list)
      } else {
        setCategories([])
      }
    } catch (err) {
      console.error('[DataBrowsing] 获取任务分类失败:', err)
      setCategories([])
    }
  }

  const fetchSellerTypes = async (taskId: number) => {
    try {
      const res = await window.electron.ipcRenderer.invoke('db:get-seller-types', taskId)
      if (res.success && res.list) {
        setSellerTypes(res.list)
      } else {
        setSellerTypes([])
      }
    } catch (err) {
      console.error('[DataBrowsing] 获取配送方式失败:', err)
      setSellerTypes([])
    }
  }

  // 2. 选中的任务变化时，重新获取当前任务下的分类和配送方式列表，并重置分类选择器和分页
  useEffect(() => {
    if (!selectedTaskId) {
      setCategories([])
      setSelectedLevels([])
      setSellerTypes([])
      setSelectedSellerType('')
      setProducts([])
      setTotalCount(0)
      return
    }

    setSelectedLevels([]) // 重置分类选择
    setSelectedSellerType('') // 重置配送方式选择
    setCurrentPage(1) // 重置分页
    fetchCategories(selectedTaskId)
    fetchSellerTypes(selectedTaskId)
  }, [selectedTaskId])

  // 3. 构建多级分类层级字典树
  const categoryTree = useMemo(() => {
    const root: CategoryNode = { name: 'root', fullPath: '', children: new Map() }

    // 解析扁平分类路径列表，构建层级树
    const allPaths: string[] = []
    categories.forEach((cat) => {
      if (cat) {
        // 支持去重拆分合流分类（如 "A | B"）
        cat.split(' | ').forEach((path) => {
          const trimmed = path.trim()
          if (trimmed && !allPaths.includes(trimmed)) {
            allPaths.push(trimmed)
          }
        })
      }
    })

    allPaths.forEach((path) => {
      const segments = path.split(' > ').map((s) => s.trim())
      let current = root
      const pathParts: string[] = []

      segments.forEach((segment) => {
        pathParts.push(segment)
        const fullPath = pathParts.join(' > ')
        if (!current.children.has(segment)) {
          current.children.set(segment, {
            name: segment,
            fullPath,
            children: new Map()
          })
        }
        current = current.children.get(segment)!
      })
    })

    return root
  }, [categories])

  // 4. 多维异步获取商品网格数据
  const fetchProducts = async () => {
    if (!selectedTaskId) return
    setIsLoadingProducts(true)

    // 拼接级联选择得到的完整类目过滤路径
    const activeCategoryPath = selectedLevels.length > 0 ? selectedLevels.join(' > ') : undefined
    const offset = (currentPage - 1) * pageSize

    try {
      const res = await window.electron.ipcRenderer.invoke('db:query-products', {
        taskId: selectedTaskId,
        query: searchQuery.trim() || undefined,
        category: activeCategoryPath,
        sellerType: selectedSellerType || undefined,
        sortBy,
        sortOrder,
        limit: pageSize,
        offset
      })

      if (res.success) {
        setProducts(res.list || [])
        setTotalCount(res.total || 0)
      } else {
        setProducts([])
        setTotalCount(0)
      }
    } catch (err) {
      console.error('[DataBrowsing] 查询商品数据异常:', err)
      setProducts([])
      setTotalCount(0)
    } finally {
      setIsLoadingProducts(false)
    }
  }

  // 依赖项更新时自动重算商品列表 (分页、任务、检索项、分类段、配送方式、排序)
  useEffect(() => {
    fetchProducts()
  }, [
    selectedTaskId,
    searchQuery,
    selectedLevels,
    selectedSellerType,
    sortBy,
    sortOrder,
    currentPage
  ])

  // 重置所有筛选条件
  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedLevels([])
    setSelectedSellerType('')
    setSortBy('rank')
    setSortOrder('ASC')
    setCurrentPage(1)
  }

  // 分类选择处理器
  const handleCategoryLevelChange = (levelIndex: number, value: string) => {
    setCurrentPage(1) // 切换类目时需要将分页重置为第1页
    if (value === '') {
      // 选择“全部子类”或清空该级，直接截断后面所有层级
      setSelectedLevels(selectedLevels.slice(0, levelIndex))
    } else {
      // 选中特定段，替换该级并清空后续层级
      const newLevels = [...selectedLevels.slice(0, levelIndex), value]
      setSelectedLevels(newLevels)
    }
  }

  // 💡 价格格式化辅助函数
  const formatPrice = (amount: number, currency: string) => {
    if (!amount || amount === 0) return '免费/未标价'

    // JPY 统一显示整数日元 (¥)，USD 显示两位小数美元 ($)
    const upperCurrency = currency.toUpperCase()
    if (upperCurrency === 'JPY') {
      return `¥${Math.round(amount).toLocaleString()}`
    } else if (upperCurrency === 'USD') {
      return `$${amount.toFixed(2)}`
    } else if (upperCurrency === 'GBP') {
      return `£${amount.toFixed(2)}`
    } else if (upperCurrency === 'EUR') {
      return `€${amount.toFixed(2)}`
    }

    return `${currency} ${amount.toLocaleString()}`
  }

  // 格式化日期显示
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

  // 格式化上架时间显示，带天数差及“新品”标签判断
  const renderAvailableField = (timestamp: number | null | undefined) => {
    if (!timestamp) return <span className="font-bold text-foreground">-</span>

    try {
      const d = new Date(timestamp)
      if (isNaN(d.getTime())) return <span className="font-bold text-foreground">-</span>

      const pad = (n: number) => n.toString().padStart(2, '0')
      const formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`

      const now = Date.now()
      const diffMs = now - timestamp
      const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
      const isNew = diffDays <= 90

      return (
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-foreground">
            {formattedDate}{' '}
            <span className="text-muted-foreground font-semibold">({diffDays}天)</span>
          </span>
          {isNew && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-extrabold uppercase bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50 shrink-0 animate-pulse">
              新品
            </span>
          )}
        </span>
      )
    } catch {
      return <span className="font-bold text-foreground">-</span>
    }
  }

  // ASIN 快捷复制
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAsin(text)
    setTimeout(() => setCopiedAsin(null), 2000)
  }

  // 💡 计算当前的级联下拉菜单列表
  // 根据 selectedLevels，动态返回每一级的可用子分类选项
  const selectLevelsOptions = useMemo(() => {
    const list: string[][] = []

    // 1. 第一级永远可用
    const level1Options = Array.from(categoryTree.children.keys())
    list.push(level1Options)

    // 2. 依次推导后续子级选项
    let currentNode = categoryTree
    for (let i = 0; i < selectedLevels.length; i++) {
      const selectedValue = selectedLevels[i]
      const nextNode = currentNode.children.get(selectedValue)
      if (nextNode && nextNode.children.size > 0) {
        list.push(Array.from(nextNode.children.keys()))
        currentNode = nextNode
      } else {
        break
      }
    }

    return list
  }, [categoryTree, selectedLevels])

  // 总页数计算
  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto bg-slate-50 dark:bg-black pb-12">
      {/* 1. 顶部数据管理标题 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-primary/10 text-primary rounded">
              <Database className="w-5 h-5 animate-pulse" />
            </span>
            <h2 className="text-xl font-bold text-foreground">数据浏览 (Data Browsing)</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            浏览与检索数据库中保存的亚马逊商品采集明细
          </p>
        </div>

        {/* 顶部动作栏 */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefreshAll}
            className="inline-flex items-center space-x-1 border border-border bg-card text-xs font-semibold py-1.5 px-3 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200"
            disabled={isLoadingTasks}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTasks ? 'animate-spin' : ''}`} />
            <span>刷新任务</span>
          </button>
        </div>
      </div>

      {/* 2. 任务全局边界选择器 Card */}
      <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-sm transition-all duration-200 hover:border-primary/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 flex-col md:flex-row md:items-center gap-4">
            {/* 数据源选择 */}
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md uppercase tracking-wider">
                数据源
              </span>
            </div>

            <div className="flex items-center gap-2 max-w-[200px] w-full shrink-0">
              <select
                value={selectedDataSource}
                onChange={(e) => setSelectedDataSource(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 font-semibold"
              >
                <option value="local">本地数据</option>
                <option value="lan-shared">局域网共享数据</option>
              </select>
              <button
                type="button"
                onClick={handleRefreshSource}
                disabled={isSourceRefreshing}
                className="p-2 border border-border rounded-md bg-card hover:bg-slate-100 dark:hover:bg-zinc-900 text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-50"
                title="刷新数据源"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSourceRefreshing ? 'animate-spin text-primary' : ''}`} />
              </button>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md uppercase tracking-wider">
                1. 选择任务标识
              </span>
            </div>

            <div className="flex-1 max-w-md">
              <select
                value={selectedTaskId}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedTaskId(val ? Number(val) : '')
                }}
                className="w-full bg-background border border-border rounded-md px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 font-semibold"
                disabled={isLoadingTasks}
              >
                {tasks.map((task) => {
                  const statusMap: Record<string, string> = {
                    running: '抓取中',
                    completed: '已完成',
                    failed: '已失败',
                    cancelled: '已终止'
                  }
                  return (
                    <option key={task.id} value={task.id}>
                      {task.task_name} (任务 ID: {task.id} |{' '}
                      {task.marketplace === 'amazon.co.jp' ? '日本站' : task.marketplace} |{' '}
                      {statusMap[task.status] || task.status})
                    </option>
                  )
                })}
                {tasks.length === 0 && !isLoadingTasks && (
                  <option value="">-- 当前尚无采集数据，请先去采集 --</option>
                )}
              </select>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              当前任务关联数
            </span>
            <p className="text-xl font-black text-primary mt-0.5">{totalCount} 条商品明细</p>
          </div>
        </div>
      </div>

      {/* 如果没有采集任务，展示精美的全屏空白态插画 */}
      {tasks.length === 0 && !isLoadingTasks ? (
        <div className="bg-card border border-border rounded-lg p-16 text-center shadow-sm flex flex-col items-center justify-center space-y-4 min-h-[400px]">
          <div className="p-5 bg-primary/5 text-primary/40 rounded-full">
            <Inbox className="w-12 h-12" />
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="text-lg font-bold text-foreground">暂无采集任务</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              本地数据库中目前没有任何抓取任务记录。请前往左侧菜单的“亚马逊采集”页面，新建并开启一个爬虫任务，成功采集后即可在此浏览多级类目下的商品！
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* 3. 多维过滤器与级联分类选择器 Card */}
          <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-sm space-y-4 transition-all duration-200 hover:border-primary/20">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold">2. 条件筛选与分类级联过滤</h4>
              </div>
              <button
                onClick={handleResetFilters}
                className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
              >
                清空全部筛选条件
              </button>
            </div>

            {/* A. 级联分类选择器 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground block">级联分类层级</label>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {selectLevelsOptions.map((options, idx) => {
                  const selectedVal = selectedLevels[idx] || ''
                  return (
                    <div key={idx} className="relative">
                      <select
                        value={selectedVal}
                        onChange={(e) => handleCategoryLevelChange(idx, e.target.value)}
                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                      >
                        <option value="">
                          {idx === 0 ? '所有主分类' : `请选择第 ${idx + 1} 级子分类`}
                        </option>
                        {options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}

                {/* 已经过滤到最深层且没有更多子分类的提示 */}
                {categories.length > 0 && selectLevelsOptions.length <= selectedLevels.length && (
                  <div className="flex items-center text-xs text-muted-foreground px-2 py-2 italic">
                    已达到分类最底层
                  </div>
                )}

                {/* 分类解析加载提示 */}
                {categories.length === 0 && (
                  <div className="col-span-full py-1 text-xs text-amber-500 font-semibold flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>该抓取任务尚未解析出可供级联的类目树。</span>
                  </div>
                )}
              </div>
            </div>

            {/* B. 文本搜索与排序规则 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* 模糊输入搜索 */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block">
                  商品检索 (ASIN 或 标题模糊匹配)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1) // 搜索变动时重置分页
                    }}
                    placeholder="输入商品标题关键字或 ASIN 编码进行全局搜索..."
                    className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                  />
                </div>
              </div>

              {/* 配送方式筛选 */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block">配送方式</label>
                <select
                  value={selectedSellerType}
                  onChange={(e) => {
                    setSelectedSellerType(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 font-semibold"
                  disabled={sellerTypes.length === 0}
                >
                  {sellerTypes.length === 0 ? (
                    <option value="">暂无配送方式</option>
                  ) : (
                    <>
                      <option value="">全部配送方式</option>
                      {sellerTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* 排序字段 */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block">排序字段</label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                >
                  <option value="rank">排行榜名次</option>
                  <option value="price_amount">销售价格</option>
                  <option value="crawled_at">采集入库时间</option>
                  <option value="id">物理自增 ID</option>
                </select>
              </div>

              {/* 排序顺序 */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block">排序方向</label>
                <div className="flex items-center space-x-2">
                  <select
                    value={sortOrder}
                    onChange={(e) => {
                      setSortOrder(e.target.value as 'ASC' | 'DESC')
                      setCurrentPage(1)
                    }}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                  >
                    <option value="ASC">升序排列 (从小到大)</option>
                    <option value="DESC">降序排列 (从大到小)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 4. 商品核心数据网格/表格 Card */}
          <div className="bg-card text-card-foreground border border-border rounded-lg p-6 shadow-sm flex flex-col justify-between transition-all duration-200 hover:border-primary/20 min-h-[400px] relative">
            {/* 顶栏信息 */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                <h3 className="font-bold text-base">商品网格视图</h3>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">
                  已加载 {products.length} 条，共 {totalCount} 条符合条件的商品
                </span>
              </div>
            </div>

            {/* 表格内容容器 */}
            <div className="relative overflow-x-auto rounded-md border border-border">
              {isLoadingProducts && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs text-primary font-bold">正在从读取数据明细...</p>
                </div>
              )}

              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-slate-50 dark:bg-slate-900/50 text-xs font-bold text-muted-foreground uppercase">
                    <th className="py-3.5 px-4 font-bold text-center w-20">缩略图</th>
                    <th className="py-3.5 px-4 font-bold min-w-[280px]">商品标题</th>
                    <th className="py-3.5 px-4 font-bold text-center w-24">配送方式</th>
                    <th className="py-3.5 px-4 font-bold text-right w-32">月销量</th>
                    <th className="py-3.5 px-4 font-bold text-center w-28">上架时间</th>
                    <th className="py-3.5 px-4 font-bold text-right w-28">单价</th>
                    <th className="py-3.5 px-4 font-bold text-center w-20">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {products.length > 0 ? (
                    products.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors duration-150"
                      >
                        {/* 1. 💡 缩略图显示 (合理大小 w-12 h-12，圆角，支持悬停轻微放大) */}
                        <td className="py-3 px-4 text-center">
                          <div className="relative inline-block w-12 h-12 rounded border border-border bg-muted overflow-hidden shrink-0 group">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.asin}
                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                                loading="lazy"
                                onError={(e) => {
                                  // 图片加载出错时的备用占位符
                                  ;(e.target as HTMLImageElement).src =
                                    'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?q=80&w=200&auto=format&fit=crop'
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                                <Inbox className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 2. 商品标题 (点击触发展示商品抓取详情 HUD) */}
                        <td
                          className="py-3 px-4 font-medium text-foreground max-w-sm truncate"
                          title={p.title}
                        >
                          <button
                            onClick={() => setActiveProductDetail(p)}
                            className="hover:underline hover:text-primary text-left font-medium block truncate w-full"
                          >
                            {p.title}
                          </button>
                        </td>

                        {/* 3.5. 配送方式 (Seller Type) */}
                        <td className="py-3 px-4 text-center">
                          {p.seller_type ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase border ${
                                p.seller_type.toUpperCase() === 'FBA'
                                  ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50'
                                  : p.seller_type.toUpperCase() === 'FBM'
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50'
                                    : p.seller_type.toUpperCase() === 'AMZ'
                                      ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50'
                                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {p.seller_type}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/45">-</span>
                          )}
                        </td>

                        {/* 3.6. 卖家精灵月销量 (Sellersprite Units) */}
                        <td className="py-3 px-4 text-right font-black text-foreground text-sm">
                          {p.sellersprite_units !== undefined && p.sellersprite_units !== null ? (
                            <span className="flex items-center justify-end space-x-1">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{p.sellersprite_units.toLocaleString()}</span>
                              <span className="text-3xs text-muted-foreground font-normal ml-0.5">
                                件
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/45">-</span>
                          )}
                        </td>

                        {/* 3.7. 上架时间天数 (Available Days) */}
                        <td className="py-3 px-4 text-center">
                          {p.sellersprite_available ? (
                            (() => {
                              const diffDays = Math.max(
                                0,
                                Math.floor(
                                  (Date.now() - p.sellersprite_available) / (1000 * 60 * 60 * 24)
                                )
                              )
                              const isNew = diffDays <= 90
                              return (
                                <span className="flex items-center justify-center space-x-1.5 font-bold text-foreground">
                                  <span>{diffDays}天</span>
                                  {isNew && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-extrabold uppercase bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50 shrink-0">
                                      新品
                                    </span>
                                  )}
                                </span>
                              )
                            })()
                          ) : (
                            <span className="text-muted-foreground/45">-</span>
                          )}
                        </td>

                        {/* 4. 单价 (格式化解耦的价格) */}
                        <td className="py-3 px-4 text-right font-black text-foreground text-sm">
                          {formatPrice(p.price_amount, p.currency)}
                        </td>

                        {/* 5. 操作项 */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center">
                            <a
                              href={p.product_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 border border-border rounded text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all"
                              title="在亚马逊网站打开"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <AlertCircle className="w-7 h-7 text-muted-foreground/45" />
                          <p className="font-bold">未找到任何匹配过滤条件的商品记录</p>
                          <p className="text-2xs text-muted-foreground max-w-xs">
                            可能原因：该任务在该级分类下没有商品，或者标题/ASIN搜索无匹配项，请尝试放宽筛选条件。
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 5. 底部扁平分页控制器 */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 mt-6 gap-4">
              <span className="text-xs text-muted-foreground font-semibold">
                显示第 {products.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} 至{' '}
                {Math.min(currentPage * pageSize, totalCount)} 条商品，共 {totalCount} 条
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
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-border rounded text-2xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                  上一页
                </button>

                <span className="text-2xs font-extrabold px-3 py-1 bg-primary/10 text-primary border border-primary/25 rounded">
                  第 {currentPage} 页 / 共 {totalPages} 页
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

      {/* 6. 商品详情模态框 (Modal Panel - Premium HUD Overlay) */}
      {activeProductDetail && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActiveProductDetail(null)}
        >
          <div
            className="bg-card text-card-foreground border border-border rounded-lg max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h4 className="font-extrabold text-sm text-foreground">商品明细</h4>
              </div>
              <button
                onClick={() => setActiveProductDetail(null)}
                className="text-xs text-muted-foreground hover:text-foreground font-black px-2 py-1 rounded hover:bg-muted"
              >
                关闭 (ESC)
              </button>
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 overflow-y-auto pr-1.5 my-3 space-y-5">
              {/* Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
                {/* Image Large */}
                <div className="sm:col-span-4 flex justify-center">
                  <div className="w-full aspect-square max-w-[160px] rounded-lg border border-border bg-slate-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden shadow-inner">
                    {activeProductDetail.image_url ? (
                      <img
                        src={activeProductDetail.image_url}
                        alt={activeProductDetail.asin}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Inbox className="w-10 h-10 text-muted-foreground/30" />
                    )}
                  </div>
                </div>

                {/* Specs */}
                <div className="sm:col-span-8 space-y-3.5">
                  <div className="space-y-1">
                    <span className="text-2xs font-extrabold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded">
                      ASIN: {activeProductDetail.asin}
                    </span>
                    <h3 className="font-bold text-sm text-foreground leading-snug">
                      {activeProductDetail.title}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 text-2xs border-t border-border pt-3">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-semibold block">
                        商品原始标价
                      </span>
                      <span className="font-bold text-foreground">
                        {activeProductDetail.original_price || '未知'}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-semibold block">价格</span>
                      <span className="font-bold text-foreground">
                        {formatPrice(
                          activeProductDetail.price_amount,
                          activeProductDetail.currency
                        )}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-semibold block">配送方式</span>
                      {activeProductDetail.seller_type ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase border self-start ${
                            activeProductDetail.seller_type.toUpperCase() === 'FBA'
                              ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50'
                              : activeProductDetail.seller_type.toUpperCase() === 'FBM'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50'
                                : activeProductDetail.seller_type.toUpperCase() === 'AMZ'
                                  ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {activeProductDetail.seller_type}
                        </span>
                      ) : (
                        <span className="font-bold text-foreground">-</span>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-semibold block">月销量</span>
                      {activeProductDetail.sellersprite_units !== undefined &&
                      activeProductDetail.sellersprite_units !== null ? (
                        <span className="font-bold text-foreground flex items-center space-x-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>{activeProductDetail.sellersprite_units.toLocaleString()} 件</span>
                        </span>
                      ) : (
                        <span className="font-bold text-foreground">-</span>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-semibold block">配送天数</span>
                      <span className="font-bold text-foreground">
                        {activeProductDetail.delivery_days || '-'}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-semibold block">
                        数据采集时间
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {formatDate(activeProductDetail.crawled_at)}
                      </span>
                    </div>

                    <div className="space-y-0.5 col-span-2 border-t border-border/50 pt-2">
                      <span className="text-muted-foreground font-semibold block">
                        商品上架时间
                      </span>
                      {renderAvailableField(activeProductDetail.sellersprite_available)}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 text-2xs">
                    <span className="text-muted-foreground font-semibold block">分类</span>
                    <div className="space-y-1.5">
                      {activeProductDetail.category_name.split(' | ').map((path, idx) => (
                        <div
                          key={idx}
                          className="bg-secondary text-secondary-foreground border border-border rounded px-2.5 py-1.5 leading-normal break-all font-medium flex items-center space-x-1.5"
                        >
                          <span className="inline-block w-1 h-1 rounded-full bg-primary shrink-0" />
                          <span>{path.trim()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BSR 热销榜排名 */}
                  <div className="space-y-2 pt-3 border-t border-border/50 text-2xs">
                    <div className="flex items-center space-x-1.5">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span className="font-extrabold text-foreground uppercase tracking-wider">
                        榜单热销排名
                      </span>
                    </div>

                    {isLoadingBsr ? (
                      <div className="flex items-center justify-center py-4 space-x-2 text-3xs text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>正在从数据库拉取 BSR 关联数据...</span>
                      </div>
                    ) : bsrRanks.length > 0 ? (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {bsrRanks.map((rank) => (
                          <div
                            key={rank.id}
                            className="flex items-start justify-between bg-secondary/50 border border-border rounded p-2.5 gap-3"
                          >
                            <div className="flex items-center space-x-2 shrink-0">
                              {rank.is_main === 1 ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-extrabold bg-amber-500 text-white dark:bg-amber-600 dark:text-amber-50">
                                  主榜
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-extrabold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  子榜
                                </span>
                              )}
                              <span className="font-extrabold text-foreground text-xs">
                                No. {rank.rank}
                              </span>
                            </div>

                            <div className="flex-1 text-2xs text-muted-foreground leading-normal break-all font-medium text-left">
                              <a
                                href={rank.href}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline hover:text-primary transition-colors flex items-center gap-1"
                                title="在亚马逊中打开此榜单"
                              >
                                <span>{rank.text}</span>
                                <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 inline" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-3xs text-muted-foreground italic border border-dashed border-border rounded bg-muted/20">
                        该商品暂无关联的排名记录
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-border">
              <button
                onClick={() => copyToClipboard(activeProductDetail.asin)}
                className="inline-flex items-center space-x-1.5 border border-border bg-background hover:bg-accent text-2xs font-semibold py-1.5 px-3 rounded-md transition-colors"
              >
                {copiedAsin === activeProductDetail.asin ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">复制成功</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>复制 ASIN 编码</span>
                  </>
                )}
              </button>

              <a
                href={activeProductDetail.product_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 bg-primary text-primary-foreground hover:bg-primary/95 text-2xs font-semibold py-1.5 px-3.5 rounded-md shadow-sm transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>在亚马逊查看</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 底部与页脚边距的缓冲元素，确保滚动回到底部时拥有优美的留白呼吸感 */}
      <div className="h-6 shrink-0" />
    </div>
  )
}
