import React, { useState } from 'react'
import {
  Sparkles,
  Copy,
  RefreshCw,
  Check,
  Database,
  Sliders,
  Globe,
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  AlertCircle,
  Play,
  FileText,
  Layers,
  ExternalLink
} from 'lucide-react'

// Crawled Seed Product Interface
interface SeedProduct {
  asin: string
  title: string
  marketplace: string
  price: string
  category: string
  complaints: { text: string; weight: string }[]
  strengths: string[]
  metrics: { rank: string; sales: string; rating: string }
  listingSamples: {
    title: string
    bullets: string[]
    desc: string
  }
}

// 3 Crawled Seed Products from SQLite linkage database
const crawledProducts: SeedProduct[] = [
  {
    asin: 'B08H1B2S3Y',
    title: 'Ergonomic Office Chair with Dynamic Lumbar Support',
    marketplace: '美国站 (US)',
    price: '$189.99',
    category: 'Home & Kitchen > Furniture > Office Chairs',
    metrics: { rank: '#1,240 in Home', sales: '3.4K+ 件/月', rating: '4.6 ⭐' },
    complaints: [
      { text: '扶手较硬且不支持宽度无级调节', weight: '34%' },
      { text: '背部高弹网面使用3个月后开始松弛', weight: '22%' },
      { text: '后仰角度锁定时偶尔有微弱异响', weight: '18%' }
    ],
    strengths: [
      '双曲面自适应腰托，贴合支撑极佳',
      '重型防爆气压棒，通过 SGS 4级安全认证',
      '底座轮滑采用静音PU，对地板零刮伤'
    ],
    listingSamples: {
      title:
        '✨ [高级蓝海爆款标题 - 精英说服力风格] ✨\n【Upgraded】Wireless Ergonomic Office Chair with Dynamic Lumbar Support - Adjustable 3D Armrest Mesh High Back Computer Desk Chair, Breathable Cushion & Smooth Caster Wheels for Home Office Study (Slate Grey)',
      bullets: [
        '1. 【DYNAMIC LUMBAR ADAPTATION】Equipped with responsive lumbar tracking that adjusts dynamically to your movement, reducing spine fatigue by 85% during extended work sessions.',
        '2. 【BREATHABLE SLATE MESH】Engineered from high-elasticity German mesh fabric that provides ultimate ventilation, avoiding sweat accumulation even in warm summer climates.',
        '3. 【FULL ADJUSTABILITY 3D】Modify headrest angle, armrest height, seat height, and tilt tension smoothly to accommodate your personal physiological comfort thresholds.',
        '4. 【REINFORCED STEEL BASE】Constructed from SGS-certified high-density reinforced cylinder and steel plate, supporting up to 350 lbs with certified structural stability.',
        '5. 【MUTE NYLON CASTERS】Fitted with 360-degree silent rolling casters that roll effortlessly over carpets, wooden floors, and rugs without causing microscopic scratches.'
      ],
      desc: 'Experience a whole new era of workspace productivity with our Next-Gen Ergonomic Workstation Chair. Designed in collaboration with professional orthopedics, every curve of this masterpiece aligns organically with human vertebral dynamics.\n\nWhether you are writing software codes, analyzing logistics spreadsheets, or having intense competitive gaming battles, the highly breathable slate-grey mesh offers refreshing airflow, keeping your posture perfectly optimized and your mind absolutely focused.'
    }
  },
  {
    asin: 'B09T8Y7X4Z',
    title: '4K UltraHD Mini Projector with WiFi 6 & Bluetooth 5.2',
    marketplace: '日本站 (JP)',
    price: '¥24,800',
    category: 'Electronics > Home Cinema > Projectors',
    metrics: { rank: '#840 in Electronics', sales: '1.2K+ 件/月', rating: '4.7 ⭐' },
    complaints: [
      { text: '白昼自然光较强时流明亮度有所衰减', weight: '40%' },
      { text: '内置 5W 扬声器低音振膜略显单薄', weight: '25%' },
      { text: '遥控器感应角度偏窄，需正对接收孔', weight: '12%' }
    ],
    strengths: [
      '机身小巧仅重 850g，支持 180° 无级旋转云台',
      '自研四向自动梯形校正，放置在床头柜也能自动投正',
      '风扇散热静音优化，分贝仪实测低于 28dB'
    ],
    listingSamples: {
      title:
        '✨ [超清4K激光投影 - 极客智能创意型] ✨\n【Native 4K】4K UltraHD Mini Projector with WiFi 6 & Bluetooth 5.2 - Portable Home Movie Projector Support Auto Keystone, 180 Degree Rotatable Gimbal & Smart Android TV for Bedroom/Outdoor (Carbon Black)',
      bullets: [
        '1. 【NATIVE 4K ULTRA GRAPHICS】Delivers true native 4K cinema resolution with 850 ANSI lumens of brightness and 15000:1 contrast ratio, bringing breathtaking details to life.',
        '2. 【WIFI 6 INSTANT CAST】Equipped with latest ultra-low latency WiFi 6 chipset for seamless wireless mirroring of iOS, Android, and laptop screens with zero lagging.',
        '3. 【180° ROTATABLE GIMBAL】Innovative physical gimbal base allows you to tilt the projection from walls to ceiling smoothly, transforming any blank sheet into a 150" screen.',
        '4. 【INTELLIGENT KEYSTONE】Features state-of-the-art auto focus and dual-axis auto keystone correction, maintaining a perfectly rectangular screen layout instantly.',
        '5. 【BT 5.2 MUTE FAN】Equipped with Bluetooth 5.2 to easily pair external soundbars, backed by advanced fan noise reduction tech that keeps background decibels under 28dB.'
      ],
      desc: 'Bring the immersive majesty of the IMAX theater right into your bedroom, backyard, or campsite. Our ultra-lightweight 4K Mini Projector features a revolutionary multi-axis gimbal base, smart Android streaming engine, and high-precision optics.\n\nWhether you are screening sports events, running retro video games, or streaming a romantic movie under the stars, this pocket powerhouse guarantees vibrant color fidelity, lightning-fast response times, and pure audio-visual bliss.'
    }
  },
  {
    asin: 'B0B8C7D6F5',
    title: 'Portable Espresso Machine 20 Bar Pressure',
    marketplace: '德国站 (DE)',
    price: '€119.00',
    category: 'Home & Kitchen > Coffee Maker > Espresso Machines',
    metrics: { rank: '#2,150 in Appliances', sales: '850+ 件/月', rating: '4.5 ⭐' },
    complaints: [
      { text: '水箱容量仅 80ml，一次性仅能冲制单杯', weight: '28%' },
      { text: '清洗残留咖啡粉的冲煮喷头微显繁琐', weight: '15%' }
    ],
    strengths: [
      '20 Bar 黄金稳定泵压，萃取咖啡油脂极其浓郁',
      '自带 12V 车载点烟器接口与标准 USB 双动力加热支持',
      '支持 Nespresso 原装胶囊与手工咖啡粉双模冲调'
    ],
    listingSamples: {
      title:
        '✨ [至臻奢享浓缩咖啡机 - 专业意式工艺型] ✨\n【20 Bar Precision】Portable Espresso Machine 20 Bar Pressure - Handheld Espresso Maker with USB & 12V Car Charger, Rechargeable Travel Espresso Cup Compatible with Pods & Ground Coffee (Espresso Brown)',
      bullets: [
        '1. 【20 BAR STABLE EXTRACTION】Engineered with premium Italian high-pressure electromagnetic pump, outputting 20-bar stable pressure to extract thick, golden crema effortlessly.',
        '2. 【DUAL POWER HEATING】Equipped with micro-thermostat heating element, powered via standard 5V USB output for slow charging, or 12V car cigarette lighter for instant 5-minute heating.',
        '3. 【POD & POWDER COMPATIBILITY】Includes modular capsules adapters, allowing you to seamlessly swap between standard Nespresso capsules and fresh-ground espresso powder.',
        '4. 【ONE-KEY OPERATION】Simplicity at its best. Simply add hot or cold water, press the button, and enjoy fresh, steaming espresso in seconds with a single click.',
        '5. 【COMPACT TRAVEL SIZE】Fitted with durable food-grade double-wall steel vacuum cup, packed inside a sleek lightweight cylinder that slides perfectly into backpack side pouches.'
      ],
      desc: 'Savor the rich, full-bodied elegance of fresh authentic espresso wherever your journeys lead you. The SellerFlow Professional 20-Bar Travel Coffee Maker heats water to exactly 92°C with absolute thermal consistency.\n\nWhether you are scaling high alpine peaks, taking long highway road trips, or surviving busy morning commutes, this high-pressure barista companion is your ultimate ticket to rich Italian crema and instantaneous physical revival.'
    }
  }
]

export const AIFunctions: React.FC = () => {
  // Linking with Crawled Seed Product Index
  const [selectedProductIndex, setSelectedProductIndex] = useState(0)
  const currentProduct = crawledProducts[selectedProductIndex]

  // Node Workflow state (Current Active Node ID)
  // 1: 数据源联动, 2: 痛点语义分析, 3: SEO Listing生成, 4: 营销配图绘制, 5: 一键上架与部署
  const [selectedNode, setSelectedNode] = useState(3)

  // Listing Generation States (Inside Node 3)
  const [listingTab, setListingTab] = useState<'title' | 'bullets' | 'desc'>('title')
  const [selectedTone, setSelectedTone] = useState<'persuasive' | 'professional' | 'creative'>(
    'persuasive'
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [listingTitle, setListingTitle] = useState(currentProduct.listingSamples.title)
  const [listingBullets, setListingBullets] = useState(currentProduct.listingSamples.bullets)
  const [listingDesc, setListingDesc] = useState(currentProduct.listingSamples.desc)
  const [copied, setCopied] = useState(false)

  // Image Generation States (Inside Node 4)
  const [imagePrompt, setImagePrompt] = useState(
    `Photorealistic studio shot of ${currentProduct.title.toLowerCase()}, floating, volumetric lighting, high-end commercial packaging, 8k render, isolated orange/blue dual gradient product background.`
  )
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [imageCount, setImageCount] = useState(3)
  const [generatedImages, setGeneratedImages] = useState<string[]>([
    'bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900',
    'bg-gradient-to-tr from-zinc-900 via-emerald-950 to-zinc-900',
    'bg-gradient-to-tr from-neutral-900 via-orange-950 to-neutral-900'
  ])

  // ERP Publisher States (Inside Node 5)
  const [targetChannel, setTargetChannel] = useState('Amazon_US_FBA')
  const [isPublishing, setIsPublishing] = useState(false)
  const [publisherLog, setPublisherLog] = useState<string[]>([
    '等待用户发起上架部署指令。',
    '[准备] 本地 ERP 数据适配包封装机制就绪，底层 SP-API 握手通路正常。'
  ])

  // Handle Dynamic Product Change
  const handleProductChange = (index: number) => {
    setSelectedProductIndex(index)
    const newProduct = crawledProducts[index]

    // Update listing contents
    setListingTitle(newProduct.listingSamples.title)
    setListingBullets(newProduct.listingSamples.bullets)
    setListingDesc(newProduct.listingSamples.desc)

    // Update image prompt
    setImagePrompt(
      `Photorealistic studio shot of ${newProduct.title.toLowerCase()}, floating, volumetric lighting, high-end commercial packaging, 8k render, isolated orange/blue dual gradient product background.`
    )

    // Reset some logs
    setPublisherLog([
      `切换至新联动商品 [${newProduct.asin}]。`,
      '[准备] 本地 ERP 数据适配包封装机制就绪，底层 SP-API 握手通路正常。'
    ])
  }

  // Handle Listing Copy
  const handleCopyListing = () => {
    let textToCopy = ''
    if (listingTab === 'title') textToCopy = listingTitle
    else if (listingTab === 'bullets') textToCopy = listingBullets.join('\n')
    else textToCopy = listingDesc

    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Handle AI Listing Regenerate
  const handleRegenerateListing = () => {
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      // Subtle variations based on tone
      const tonePrefix =
        selectedTone === 'persuasive'
          ? '🌟 [说服力风格升级版]'
          : selectedTone === 'professional'
            ? '📊 [行业级专业型优化]'
            : '💡 [极客先锋创意风格]'

      if (listingTab === 'title') {
        setListingTitle(
          `${tonePrefix}\n${currentProduct.listingSamples.title.replace(/✨.*✨\n/, '')}`
        )
      } else if (listingTab === 'bullets') {
        setListingBullets(currentProduct.listingSamples.bullets.map((b) => `${tonePrefix} ${b}`))
      } else {
        setListingDesc(`${tonePrefix}\n\n${currentProduct.listingSamples.desc}`)
      }
    }, 1500)
  }

  // Handle AI Image Generation Simulator
  const handleGenerateImage = () => {
    setIsGeneratingImage(true)
    setTimeout(() => {
      setIsGeneratingImage(false)
      // Dynamic shift of visual mockup themes
      setGeneratedImages([
        'bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-950',
        'bg-gradient-to-tr from-emerald-950 via-zinc-900 to-emerald-950',
        'bg-gradient-to-tr from-rose-950 via-neutral-900 to-rose-950'
      ])
    }, 2000)
  }

  // Handle ERP Publisher Simulator
  const handlePublishToERP = () => {
    setIsPublishing(true)
    setPublisherLog((prev) => [
      ...prev,
      `[开始] ${new Date().toLocaleTimeString()} 正在打包 ASIN [${currentProduct.asin}] 的 AI 资产封包...`,
      `[参数] 文本包包含: 1x 标题, 5x 卖点描述, 1x 详情描述 (Tone: ${selectedTone})`,
      `[参数] 图像包包含: ${imageCount}x 8K 高清营销渲染图，比例: [${aspectRatio}]`
    ])

    setTimeout(() => {
      setPublisherLog((prev) => [
        ...prev,
        `[验证] 本地校验成功。字段校验率 100%，已剔除亚马逊违禁词。`,
        `[连接] 正在建立与 ERP 接口的 SSL 握手连接通路...`,
        `[推送] 正在推送至 [${targetChannel}] FBA 新建上架发布队列...`
      ])
    }, 1500)

    setTimeout(() => {
      setPublisherLog((prev) => [
        ...prev,
        `[上架成功] 🎉 ASIN ${currentProduct.asin} 数据包已成功同步至 ERP 及 Amazon SP-API 后台！任务暂驻发布队列中。`
      ])
      setIsPublishing(false)
    }, 3200)
  }

  // Workflow Nodes Metadata
  const workflowNodes = [
    { id: 1, name: '数据源联动', sub: 'Crawled Ingest', icon: Database, color: 'text-blue-500' },
    {
      id: 2,
      name: '痛点语义分析',
      sub: 'Sentiment Analysis',
      icon: Sliders,
      color: 'text-violet-500'
    },
    {
      id: 3,
      name: 'SEO Listing生成',
      sub: 'Listing Copilot',
      icon: Sparkles,
      color: 'text-indigo-500'
    },
    {
      id: 4,
      name: '营销配图绘制',
      sub: 'Diffusion Image',
      icon: ImageIcon,
      color: 'text-emerald-500'
    },
    { id: 5, name: '一键上架与部署', sub: 'ERP Publisher', icon: Globe, color: 'text-rose-500' }
  ]

  return (
    <div className="p-6 space-y-6 flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-black">
      {/* 🚀 Top Section: Seed Product Database Linkage Selector */}
      <div className="bg-card text-card-foreground border border-border rounded-xl p-5 grid grid-cols-1 lg:grid-cols-12 items-center gap-5 shadow-xs shrink-0">
        {/* Left Side: Description Text (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-1">
          <div className="flex items-center space-x-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h2 className="font-extrabold text-sm text-foreground">
              SQLite 采集数据源双向联动控制
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground leading-normal">
            从已完成爬行的亚马逊 SQLite 本地库中直接读取商品作为 AI 优化的爆款母体，打破孤岛数据屏障
          </p>
        </div>

        {/* Right Side: Product Selector buttons (lg:col-span-5) */}
        <div className="lg:col-span-5 flex flex-col sm:flex-row sm:items-center lg:justify-end gap-3 w-full min-w-0">
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold shrink-0">
            选择联动母体 ASIN:
          </span>
          <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto min-w-0">
            {crawledProducts.map((p, index) => {
              const isSelected = selectedProductIndex === index
              return (
                <button
                  key={p.asin}
                  onClick={() => handleProductChange(index)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex flex-col items-center justify-center text-center leading-tight sm:min-w-[100px] shrink-0 ${
                    isSelected
                      ? 'border-primary bg-primary/5 text-primary shadow-xs'
                      : 'border-border bg-background hover:bg-slate-100 dark:hover:bg-zinc-900 text-muted-foreground'
                  }`}
                  title={p.title}
                >
                  <span className="font-mono text-[9px] font-bold">{p.asin}</span>
                  <span className="text-[9px] text-muted-foreground truncate w-full max-w-[80px]">
                    {index === 0 ? '人体工学椅' : index === 1 ? '微型投影仪' : '意式咖啡机'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 🔮 Middle Section: Visual AI Agent Workflow Node Timeline */}
      <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-xs shrink-0">
        <div className="flex items-center space-x-1.5 pb-4 mb-4 border-b border-border">
          <Layers className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
            亚马逊 AI 流程自动化可视化工作台
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-stretch relative">
          {workflowNodes.map((node) => {
            const Icon = node.icon
            // Statuses based on current selectedNode
            const isCompleted = node.id < selectedNode
            const isActive = node.id === selectedNode

            return (
              <React.Fragment key={node.id}>
                <div
                  onClick={() => setSelectedNode(node.id)}
                  className={`cursor-pointer group relative p-3.5 rounded-xl border flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 ${
                    isActive
                      ? 'border-primary bg-primary/5 shadow-xs dark:bg-primary/10'
                      : isCompleted
                        ? 'border-emerald-500/20 bg-emerald-500/2 dark:bg-emerald-500/5 hover:border-emerald-500/40'
                        : 'border-border bg-background hover:border-slate-400 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    {/* Circle icon wrapper */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                          : isCompleted
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-zinc-900 text-muted-foreground'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Completion badge status */}
                    <div>
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : isActive ? (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700"></div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="text-[9px] font-mono font-bold text-muted-foreground block uppercase">
                      Node 0{node.id} • {isCompleted ? '已完成' : isActive ? '进行中' : '等待激活'}
                    </span>
                    <h4 className="text-xs font-bold text-foreground mt-0.5 group-hover:text-primary transition-colors">
                      {node.name}
                    </h4>
                    <span className="text-[10px] text-muted-foreground block truncate mt-0.5 font-mono">
                      {node.sub}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* 💻 Bottom Section: Dynamic Interactive Active Workspce */}
      <div className="flex-1 min-h-[460px] flex items-stretch">
        {/* --- NODE 1 WORKSPACE: DATA INGESTION VIEW --- */}
        {selectedNode === 1 && (
          <div className="w-full bg-card text-card-foreground border border-border rounded-xl p-6 flex flex-col justify-between gap-6 shadow-xs animate-fade-in">
            <div className="space-y-4 flex-1">
              <div className="pb-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-foreground">已绑定母体商品细节</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    从本地 SQLite 数据表中已增量匹配提取的母体核心参数
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-1 bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold border border-blue-200/50 dark:border-blue-800/30 rounded-full">
                  SQLite 双向数据绑定中
                </span>
              </div>

              {/* Product Info parameters cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-zinc-900/30 border border-border rounded-lg space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    母体标的 (ASIN)
                  </span>
                  <div className="text-sm font-extrabold text-foreground font-mono flex items-center gap-1.5">
                    <span>{currentProduct.asin}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-zinc-900/30 border border-border rounded-lg space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    基准采集目录与平台
                  </span>
                  <div className="text-sm font-extrabold text-foreground truncate">
                    {currentProduct.category.split(' > ').pop()} • 亚马逊{' '}
                    {currentProduct.marketplace.replace('站', '')}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-zinc-900/30 border border-border rounded-lg space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    参考零售价 & 销售指数
                  </span>
                  <div className="text-sm font-extrabold text-foreground font-mono">
                    {currentProduct.price} • {currentProduct.metrics.sales}
                  </div>
                </div>
              </div>

              {/* Mock SQLite query table result */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-primary" />
                  <span>SQLite 本地抓取数据流 (JSON/JSONB SQL Select Field View)</span>
                </label>
                <div className="bg-slate-950 dark:bg-black border border-border/80 rounded-lg p-4 font-mono text-[10.5px] text-slate-300 overflow-x-auto space-y-1.5">
                  <div className="text-slate-500">
                    // SELECT * FROM amz_crawler_products WHERE asin = '{currentProduct.asin}' LIMIT
                    1;
                  </div>
                  <div>
                    <span className="text-sky-400">"asin"</span>:{' '}
                    <span className="text-amber-400">"{currentProduct.asin}"</span>,
                  </div>
                  <div>
                    <span className="text-sky-400">"marketplace"</span>:{' '}
                    <span className="text-amber-400">"{currentProduct.marketplace}"</span>,
                  </div>
                  <div className="truncate">
                    <span className="text-sky-400">"title"</span>:{' '}
                    <span className="text-emerald-400">"{currentProduct.title}"</span>,
                  </div>
                  <div>
                    <span className="text-sky-400">"price"</span>:{' '}
                    <span className="text-amber-400">"{currentProduct.price}"</span>,
                  </div>
                  <div className="truncate">
                    <span className="text-sky-400">"category"</span>:{' '}
                    <span className="text-amber-400">"{currentProduct.category}"</span>,
                  </div>
                  <div>
                    <span className="text-sky-400">"crawled_at"</span>:{' '}
                    <span className="text-violet-400">"2026-05-31 10:15:32"</span>,
                  </div>
                  <div>
                    <span className="text-sky-400">"engine_version"</span>:{' '}
                    <span className="text-amber-400">"DFS_Crawler_v1.2"</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-[11px] text-muted-foreground">
                母体提取正常。所有关联大模型节点均同步响应。
              </span>
              <button
                onClick={() => setSelectedNode(2)}
                className="inline-flex items-center justify-center space-x-1.5 bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-md hover:bg-primary/95 text-xs transition-all"
              >
                <span>进入下一步 (情绪痛点挖掘)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* --- NODE 2 WORKSPACE: SENTIMENT ANALYSIS VIEW --- */}
        {selectedNode === 2 && (
          <div className="w-full bg-card text-card-foreground border border-border rounded-xl p-6 flex flex-col justify-between gap-6 shadow-xs animate-fade-in">
            <div className="space-y-5 flex-1">
              <div className="pb-4 border-b border-border">
                <h3 className="text-base font-extrabold text-foreground">
                  AI 竞品核心痛点与卖点深度语义分析
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  基于大语言模型对该品类 1000+ 条真实买家 Review
                  文本的聚类挖掘，找出核心痛点进行精准降维打击
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Complaints Sentiment block */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    <span>竞品核心客户吐槽重灾区 (用户负面痛点聚类)</span>
                  </h4>
                  <div className="space-y-3 bg-rose-500/2 dark:bg-rose-950/10 border border-rose-500/10 rounded-xl p-4">
                    {currentProduct.complaints.map((c, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          <span>{c.text}</span>
                          <span className="font-mono text-rose-500 font-bold">{c.weight}</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-rose-500 h-full rounded-full"
                            style={{ width: c.weight }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Strengths Sentiment block */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>我方商品继承及优化重点 (用户正面卖点保留)</span>
                  </h4>
                  <div className="space-y-3.5 bg-emerald-500/2 dark:bg-emerald-950/10 border border-emerald-500/10 rounded-xl p-4">
                    {currentProduct.strengths.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-start space-x-2 text-xs text-slate-700 dark:text-zinc-300 leading-normal"
                      >
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dynamic AI direction guidance */}
              <div className="space-y-1.5 bg-slate-50 dark:bg-zinc-900/30 border border-border p-3.5 rounded-lg text-xs leading-normal">
                <span className="font-bold text-slate-700 dark:text-zinc-300 block mb-0.5">
                  💡 AI 降维打击改写指导建议
                </span>
                建议在下一步 Listing
                生成中，针对竞品高发缺陷进行文案反向强力突出，例如突出我方的“阻燃静音安全”、“网布高耐久防塌陷”、“气动阀零故障后弯”等特性，一击即中！
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-[11px] text-muted-foreground">深度语义聚类计算已完成。</span>
              <button
                onClick={() => setSelectedNode(3)}
                className="inline-flex items-center justify-center space-x-1.5 bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-md hover:bg-primary/95 text-xs transition-all"
              >
                <span>导入优化大模型 (生成爆款 Listing)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* --- NODE 3 WORKSPACE: SEO LISTING COPILOT VIEW --- */}
        {selectedNode === 3 && (
          <div className="w-full bg-card text-card-foreground border border-border rounded-xl p-6 flex flex-col justify-between gap-6 shadow-xs animate-fade-in">
            <div className="space-y-4 flex-1">
              <div className="pb-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-foreground">
                    AI 爆款 SEO Listing 智能撰写工坊
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    根据痛点剖析结果自适应降维改写，全面植入核心高流量 Search Terms 搜索权重词
                  </p>
                </div>

                {/* Tone settings */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-semibold shrink-0">
                    改写文风语气:
                  </span>
                  <select
                    value={selectedTone}
                    onChange={(e) => setSelectedTone(e.target.value as any)}
                    className="bg-background border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer font-medium"
                  >
                    <option value="persuasive">强力推荐说服型 (Persuasive)</option>
                    <option value="professional">高专业性客观型 (Professional)</option>
                    <option value="creative">富含情感创意型 (Creative)</option>
                  </select>
                </div>
              </div>

              {/* Target listing category tabs */}
              <div className="flex border-b border-border/80">
                <button
                  onClick={() => setListingTab('title')}
                  className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
                    listingTab === 'title'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  亚马逊 SEO 黄金标题 (Amazon SEO Title)
                </button>
                <button
                  onClick={() => setListingTab('bullets')}
                  className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
                    listingTab === 'bullets'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  五点描述 (High-Converting Bullets)
                </button>
                <button
                  onClick={() => setListingTab('desc')}
                  className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
                    listingTab === 'desc'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  SEO 详情描述 (Product Description)
                </button>
              </div>

              {/* Content workspace area */}
              <div className="flex-1 bg-slate-50 dark:bg-zinc-950/20 border border-border/80 rounded-xl p-5 text-xs leading-relaxed overflow-y-auto whitespace-pre-wrap select-text h-0 min-h-[180px] font-mono text-slate-800 dark:text-zinc-200">
                {isGenerating ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-2.5">
                    <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                    <p className="text-[11px] text-muted-foreground">
                      正在基于本品特性与竞品缺陷分析，精细化重构爆款文案中...
                    </p>
                  </div>
                ) : listingTab === 'title' ? (
                  <div>{listingTitle}</div>
                ) : listingTab === 'bullets' ? (
                  <div className="space-y-3">
                    {listingBullets.map((bullet, index) => (
                      <div key={index} className="pb-2 border-b border-border/40 last:border-b-0">
                        {bullet}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>{listingDesc}</div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRegenerateListing}
                  disabled={isGenerating}
                  className="inline-flex items-center justify-center space-x-1.5 border border-border bg-background hover:bg-accent text-xs font-semibold py-1.5 px-3 rounded-md transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>深度重构优化</span>
                </button>
                <button
                  onClick={handleCopyListing}
                  className="inline-flex items-center justify-center space-x-1.5 border border-border bg-background hover:bg-accent text-xs font-semibold py-1.5 px-3 rounded-md transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500">已复制!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>一键复制此字段</span>
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => setSelectedNode(4)}
                className="inline-flex items-center justify-center space-x-1.5 bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-md hover:bg-primary/95 text-xs transition-all animate-pulse"
              >
                <span>进入配图绘制阶段 (AI 营销图资产)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* --- NODE 4 WORKSPACE: DIFFUSION IMAGE VIEW --- */}
        {selectedNode === 4 && (
          <div className="w-full bg-card text-card-foreground border border-border rounded-xl p-6 flex flex-col justify-between gap-6 shadow-xs animate-fade-in">
            <div className="space-y-4 flex-1">
              <div className="pb-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-foreground">
                    AI 高清高转化营销配图渲染舱
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    调用 Diffusion 大模型，一键为商品重绘摄影棚白底主图、高端户外或家居生活场景图
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Settings of generation */}
                <div className="lg:col-span-5 space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                      生图视觉引导词 (Prompt)
                    </label>
                    <textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      rows={3}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono resize-none leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                        尺寸与构图比例
                      </label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer font-semibold"
                      >
                        <option value="1:1">1:1 (亚马逊主图标准)</option>
                        <option value="16:9">16:9 (头图视频/横幅)</option>
                        <option value="9:16">9:16 (社交媒体 Feeds)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                        一次渲染图片数量
                      </label>
                      <select
                        value={imageCount}
                        onChange={(e) => setImageCount(Number(e.target.value))}
                        className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer font-semibold"
                      >
                        <option value={1}>渲染 1 张</option>
                        <option value={3}>渲染 3 张 (生成对照组)</option>
                        <option value={5}>渲染 5 张 (海量方案)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage}
                    className="w-full inline-flex items-center justify-center space-x-2 bg-primary/10 text-primary dark:bg-primary/20 hover:bg-primary/15 dark:hover:bg-primary/25 font-bold py-2 rounded-lg text-xs transition-all border border-primary/20"
                  >
                    {isGeneratingImage ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>正在跑图渲染中... (预计耗时2秒)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>开启智能跑图渲染 (Text-to-Image)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Generated assets gallery grid */}
                <div className="lg:col-span-7 space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide block">
                    已绘制的高清营销资产库 (AI Render Assets)
                  </label>

                  {isGeneratingImage ? (
                    <div className="border border-border/80 rounded-xl h-[170px] bg-slate-950/20 dark:bg-black/40 flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                      <span className="text-[11px] text-muted-foreground font-mono">
                        DALL-E-3 / Stable Diffusion 引擎正在极速出图...
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {generatedImages.slice(0, imageCount).map((bg, idx) => (
                        <div
                          key={idx}
                          className={`group relative overflow-hidden rounded-xl border border-border h-[170px] ${bg} flex flex-col justify-between p-3.5 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-pointer`}
                        >
                          {/* Circle Badge overlay */}
                          <div className="w-5 h-5 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-[9px] text-white font-mono font-bold">
                            #{idx + 1}
                          </div>

                          {/* Beautiful graphic visual center placeholders */}
                          <div className="flex-1 flex flex-col items-center justify-center space-y-1.5 text-center pt-2">
                            <ImageIcon className="w-7 h-7 text-white/50 group-hover:scale-110 transition-transform duration-300 animate-pulse" />
                            <span className="text-[9.5px] text-white/70 font-mono tracking-wider font-extrabold uppercase bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-xs">
                              {currentProduct.asin} Render
                            </span>
                          </div>

                          {/* Card bottom text */}
                          <div className="text-[9px] text-white/50 truncate text-center font-mono">
                            {aspectRatio} •{' '}
                            {idx === 0
                              ? '摄影棚白底图'
                              : idx === 1
                                ? '家居品质生活'
                                : '多色户外场景'}
                          </div>
                        </div>
                      ))}
                      {imageCount < 3 && (
                        <div className="border-2 border-dashed border-border/60 rounded-xl h-[170px] flex items-center justify-center text-muted-foreground text-[10px] font-semibold bg-slate-50/20">
                          暂无对照组
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-[11px] text-muted-foreground">
                Diffusion 生图渲染正常。我方上架图层资源就绪。
              </span>
              <button
                onClick={() => setSelectedNode(5)}
                className="inline-flex items-center justify-center space-x-1.5 bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-md hover:bg-primary/95 text-xs transition-all"
              >
                <span>进入最后的上架发布阶段</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* --- NODE 5 WORKSPACE: ERP PUBLISHER VIEW --- */}
        {selectedNode === 5 && (
          <div className="w-full bg-card text-card-foreground border border-border rounded-xl p-6 flex flex-col justify-between gap-6 shadow-xs animate-fade-in">
            <div className="space-y-4 flex-1">
              <div className="pb-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-foreground">
                    一键跨境 ERP 接口与亚马逊 SP-API 发布部署中心
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    将智能重构的 Listing 文案资产及 AI 营销配图一键直接同步封装，推送至第三方 ERP
                    待上架队列
                  </p>
                </div>

                {/* Target channels options */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-semibold shrink-0">
                    选择上架目标通道:
                  </span>
                  <select
                    value={targetChannel}
                    onChange={(e) => setTargetChannel(e.target.value)}
                    className="bg-background border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer font-medium"
                  >
                    <option value="Amazon_US_FBA">亚马逊美国站 (Amazon US - FBA)</option>
                    <option value="Amazon_JP_FBA">亚马逊日本站 (Amazon JP - FBA)</option>
                    <option value="Shopify_Default">独立站 (Shopify Store API)</option>
                    <option value="Mabang_ERP">马帮 ERP 自动化推送接口</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left side: Payload preview */}
                <div className="lg:col-span-5 space-y-2">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>ERP API 封装上架 JSON 结构体预览 (Structured Payload)</span>
                  </label>
                  <div className="bg-slate-950 dark:bg-black border border-border/80 rounded-lg p-4 font-mono text-[9.5px] text-slate-300 overflow-y-auto h-[170px] space-y-1">
                    <div>{`{`}</div>
                    <div>
                      {' '}
                      <span className="text-sky-400">"asin_seed"</span>:{' '}
                      <span className="text-amber-400">"{currentProduct.asin}"</span>,
                    </div>
                    <div>
                      {' '}
                      <span className="text-sky-400">"target_channel"</span>:{' '}
                      <span className="text-amber-400">"{targetChannel}"</span>,
                    </div>
                    <div>
                      {' '}
                      <span className="text-sky-400">"payload_data"</span>: {`{`}
                    </div>
                    <div className="truncate">
                      {' '}
                      <span className="text-sky-400">"title"</span>:{' '}
                      <span className="text-emerald-400">"{listingTitle.replace(/\n/g, ' ')}"</span>
                      ,
                    </div>
                    <div>
                      {' '}
                      <span className="text-sky-400">"bullets_count"</span>:{' '}
                      <span className="text-amber-400">5</span>,
                    </div>
                    <div>
                      {' '}
                      <span className="text-sky-400">"image_assets_uploaded"</span>:{' '}
                      <span className="text-amber-400">{imageCount}</span>
                    </div>
                    <div> {`}`}</div>
                    <div>{`}`}</div>
                  </div>
                </div>

                {/* Right side: terminal log and glowing button */}
                <div className="lg:col-span-7 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1.5 flex-1 flex flex-col">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide block shrink-0">
                      上架发布事务运行状态控制台 (Publisher Console)
                    </label>
                    <div className="flex-1 bg-slate-950 dark:bg-black border border-border/80 rounded-lg p-4 font-mono text-[10px] text-slate-300 overflow-y-auto space-y-1 h-[140px] max-h-[140px]">
                      {publisherLog.map((log, idx) => {
                        let color = 'text-slate-400'
                        if (log.startsWith('[成功]') || log.startsWith('[上架成功]'))
                          color = 'text-emerald-400 font-semibold'
                        if (log.startsWith('[开始]') || log.startsWith('[参数]'))
                          color = 'text-sky-400'
                        if (log.startsWith('[验证]')) color = 'text-amber-400'
                        if (log.startsWith('[推送]')) color = 'text-indigo-400'
                        return (
                          <div key={idx} className={color}>
                            {log}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-[11px] text-muted-foreground">一键推送机制已准备。</span>
              <button
                onClick={handlePublishToERP}
                disabled={isPublishing}
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-primary-foreground font-semibold px-6 py-2.5 rounded-lg text-xs transition-all shadow-md shadow-primary/10 hover:shadow-lg disabled:opacity-50 hover:-translate-y-[1px] active:translate-y-0"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>自动发布上架部署中...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>一键上架至 ERP / Amazon SP-API 后台</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
export default AIFunctions
