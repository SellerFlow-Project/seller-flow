import React, { useState } from 'react'
import {
  Sun,
  Moon,
  Database,
  Settings,
  Sliders,
  CheckCircle,
  Bell,
  Mail,
  Info,
  Server,
  Check,
  Globe,
  Trash2,
  Brain,
  Cpu,
  Image as ImageIcon
} from 'lucide-react'
import { useAppStore } from '../store/appStore'

// Nested Toggle Switch Component for UI Consistency
interface ToggleSwitchProps {
  checked: boolean
  onChange: (val: boolean) => void
  label: string
  description?: string
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, description }) => {
  return (
    <div className="flex items-start justify-between py-3 border-b border-border/40 last:border-b-0">
      <div className="space-y-0.5 pr-4">
        <label className="text-sm font-semibold text-foreground select-none cursor-pointer" onClick={() => onChange(!checked)}>
          {label}
        </label>
        {description && <p className="text-[11px] text-muted-foreground leading-normal">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full transition-colors relative shrink-0 focus:outline-none border ${
          checked
            ? 'bg-primary border-primary'
            : 'bg-slate-200 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700'
        }`}
      >
        <span
          className={`w-5 h-5 rounded-full bg-white absolute left-0 top-0.5 transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
    </div>
  )
}

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useAppStore()

  // Setting sections tabs
  const [activeSection, setActiveSection] = useState<'app' | 'notifications' | 'crawling' | 'ai' | 'about'>('app')

  // Theme Swatch Colors
  const [themeColor, setThemeColor] = useState<'blue' | 'emerald' | 'violet' | 'amber' | 'rose'>('blue')

  // SMTP Notifications states
  const [smtpHost, setSmtpHost] = useState('smtp.qq.com')
  const [smtpPort, setSmtpPort] = useState('465')
  const [smtpUser, setSmtpUser] = useState('sellerflow_notify@qq.com')
  const [smtpPass, setSmtpPass] = useState('••••••••••••••••')
  const [notifySuccess, setNotifySuccess] = useState(true)
  const [notifyFailure, setNotifyFailure] = useState(true)

  // Crawl Configuration states
  const [clearHistoryOnNewTask, setClearHistoryOnNewTask] = useState(true)
  const [dbPath, setDbPath] = useState('/Users/ceneax/Project/Electron/seller-flow/seller-flow.db')
  const [crawlInterval, setCrawlInterval] = useState(3000)
  const [threadLimit, setThreadLimit] = useState(4)
  const [proxyUrl, setProxyUrl] = useState('http://127.0.0.1:7890')

  // AI Config states
  const [textApiEndpoint, setTextApiEndpoint] = useState('https://api.deepseek.com/v1')
  const [textModelName, setTextModelName] = useState('deepseek-chat')
  const [textApiKey, setTextApiKey] = useState('sk-••••••••••••••••')

  const [imageApiEndpoint, setImageApiEndpoint] = useState('https://api.openai.com/v1')
  const [imageModelName, setImageModelName] = useState('dall-e-3')
  const [imageApiKey, setImageApiKey] = useState('sk-••••••••••••••••')

  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleSave = () => {
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2500)
  }

  // Swatch colors utility
  const colorSwatches = [
    { key: 'blue', bg: 'bg-blue-500', border: 'border-blue-400', name: '经典科技蓝' },
    { key: 'emerald', bg: 'bg-emerald-500', border: 'border-emerald-400', name: '生机翡翠绿' },
    { key: 'violet', bg: 'bg-violet-500', border: 'border-violet-400', name: '极客魔力紫' },
    { key: 'amber', bg: 'bg-amber-500', border: 'border-amber-400', name: '明朗温暖黄' },
    { key: 'rose', bg: 'bg-rose-500', border: 'border-rose-400', name: '活力樱桃红' }
  ] as const

  return (
    <div className="p-6 space-y-6 flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-black">

      {/* Settings Canvas Layout wrapper */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1 min-h-0">

        {/* Left Side: Settings Nav Tabs Sidebar (lg:col-span-3) */}
        <div className="lg:col-span-3 bg-card text-card-foreground border border-border rounded-lg p-4 flex flex-col justify-between shrink-0 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 px-3 pb-3 mb-3 border-b border-border">
              <Settings className="w-4 h-4 text-primary" />
              <h2 className="font-bold text-sm">控制台配置项</h2>
            </div>

            {/* Section Tab Buttons */}
            <button
              onClick={() => setActiveSection('app')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
                activeSection === 'app'
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100/50 dark:hover:bg-zinc-900/40'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>应用程序设置</span>
            </button>

            <button
              onClick={() => setActiveSection('notifications')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
                activeSection === 'notifications'
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100/50 dark:hover:bg-zinc-900/40'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>通知服务配置</span>
            </button>

            <button
              onClick={() => setActiveSection('crawling')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
                activeSection === 'crawling'
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100/50 dark:hover:bg-zinc-900/40'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>采集运行配置</span>
            </button>

            <button
              onClick={() => setActiveSection('ai')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
                activeSection === 'ai'
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100/50 dark:hover:bg-zinc-900/40'
              }`}
            >
              <Brain className="w-4 h-4" />
              <span>AI大模型配置</span>
            </button>

            <button
              onClick={() => setActiveSection('about')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
                activeSection === 'about'
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100/50 dark:hover:bg-zinc-900/40'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>关于 SellerFlow</span>
            </button>
          </div>

          {/* Quick Sandbox Info Card */}
          <div className="bg-slate-50 dark:bg-zinc-900/30 border border-border p-3.5 rounded-lg text-[10px] text-muted-foreground leading-normal shrink-0">
            <span className="font-bold text-slate-700 dark:text-zinc-300 block mb-0.5">本地沙盒架构保证</span>
            所有设置均由底层客户端独立进行状态同步与文件写入，软件卸载或更新均不会丢失您的个性化数据。
          </div>
        </div>

        {/* Right Side: Active Settings Panel Content (lg:col-span-9) */}
        <div className="lg:col-span-9 bg-card text-card-foreground border border-border rounded-lg p-6 flex flex-col justify-between shadow-sm min-h-[460px]">

          <div className="flex-1">
            {/* --- 1. APPLICATION SETTINGS --- */}
            {activeSection === 'app' && (
              <div className="space-y-6 animate-fade-in">
                <div className="pb-4 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">应用程序设置</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    自定您的界面皮肤，修改主系统的主题色调呈现
                  </p>
                </div>

                {/* Theme Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    界面皮肤主题
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex items-center justify-center space-x-2.5 p-3 rounded-lg border text-xs font-semibold transition-all ${
                        theme === 'light'
                          ? 'border-primary bg-primary/5 text-primary shadow-xs'
                          : 'border-border bg-background hover:bg-slate-50 dark:hover:bg-zinc-900 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      <span>明亮白模式 (Light Mode)</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex items-center justify-center space-x-2.5 p-3 rounded-lg border text-xs font-semibold transition-all ${
                        theme === 'dark'
                          ? 'border-primary bg-primary/5 text-primary shadow-xs'
                          : 'border-border bg-background hover:bg-slate-50 dark:hover:bg-zinc-900 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      <span>科技暗黑模式 (Dark Mode)</span>
                    </button>
                  </div>
                </div>

                {/* Accent Color Swatches */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    外观配色方案
                  </label>
                  <p className="text-[11px] text-muted-foreground leading-normal mb-3">
                    选择符合您当前情绪与行业风格的配色，小至按钮、进度方块均会跟随主题色流转：
                  </p>
                  <div className="flex items-center gap-4">
                    {colorSwatches.map((color) => {
                      const isSelected = themeColor === color.key
                      return (
                        <button
                          key={color.key}
                          onClick={() => setThemeColor(color.key)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${color.bg} ${
                            isSelected
                              ? 'ring-4 ring-offset-2 ring-primary dark:ring-offset-black scale-110 shadow-md'
                              : 'hover:scale-105'
                          }`}
                          title={color.name}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white font-bold" />}
                        </button>
                      )}
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- 2. NOTIFICATION SETTINGS --- */}
            {activeSection === 'notifications' && (
              <div className="space-y-6 animate-fade-in">
                <div className="pb-4 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">通知服务设置</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    配置第三方邮件传输协议 (SMTP)，供采集任务在成功或失败时自动向指定邮箱发送详情报表
                  </p>
                </div>

                {/* SMTP Credentials Inputs */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span>SMTP 邮箱服务身份凭证</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        SMTP 发送主机
                      </label>
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="例如: smtp.qq.com"
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        加密端口号 (Port)
                      </label>
                      <input
                        type="text"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        placeholder="例如: 465"
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        发件人邮箱账号
                      </label>
                      <input
                        type="text"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="例如: user@qq.com"
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        SMTP 客户端授权密码 / Token
                      </label>
                      <input
                        type="password"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Notifications Switches */}
                <div className="space-y-1 pt-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <Sliders className="w-3.5 h-3.5 text-primary" />
                    <span>通知事件触发器配置</span>
                  </h4>
                  <div className="bg-slate-50 dark:bg-zinc-900/20 border border-border/80 rounded-xl px-4 py-1">
                    <ToggleSwitch
                      checked={notifySuccess}
                      onChange={setNotifySuccess}
                      label="任务成功通知 (On Task Success)"
                      description="当分类深度 DFS 排行榜爬行任务以及并轨详情并发提取成功完结时，自动向您的发件人账号/设定收件箱内推送详细的汇总统计与已入库商品 SKU 数量报告。"
                    />
                    <ToggleSwitch
                      checked={notifyFailure}
                      onChange={setNotifyFailure}
                      label="任务失败告警通知 (On Task Failure)"
                      description="如果发生了极高频率的网络反爬虫检测封杀、网关代理长时间无响应造成强制终止等状况，立即发送带警示色块的故障通知，包含最新的 logs 控制台断点排查记录。"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* --- 3. CRAWLING SETTINGS --- */}
            {activeSection === 'crawling' && (
              <div className="space-y-6 animate-fade-in">
                <div className="pb-4 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">采集运行配置</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    微调底层多线程抓取参数、设置翻页延时以抵御爬虫风控，并规划历史数据的清洗模式
                  </p>
                </div>

                {/* Data Cleaning Switch */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5 text-primary" />
                    <span>本地数据库数据清洗策略</span>
                  </label>
                  <div className="bg-slate-50 dark:bg-zinc-900/20 border border-border/80 rounded-xl px-4 py-1">
                    <ToggleSwitch
                      checked={clearHistoryOnNewTask}
                      onChange={setClearHistoryOnNewTask}
                      label="每次新建任务都清空历史任务数据"
                      description="开启此策略后，每次当您点击“开启亚马逊采集”来执行新任务时，系统会自动清空数据库本地缓冲的旧商品记录，保证全新任务只显示干净的对应商品数据。若关闭此策略，数据会做增量增补插入。"
                    />
                  </div>
                </div>

                {/* Database Path */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-primary" />
                    <span>SQLite 本地数据库文件存储绝对路径</span>
                  </label>
                  <input
                    type="text"
                    value={dbPath}
                    onChange={(e) => setDbPath(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Threads Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-primary" />
                      <span>最大并发下载线程限制</span>
                    </label>
                    <select
                      value={threadLimit}
                      onChange={(e) => setThreadLimit(Number(e.target.value))}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                    >
                      <option value={2}>2 线程 (安全防封型)</option>
                      <option value={4}>4 线程 (推荐标准型)</option>
                      <option value={8}>8 线程 (高速并发型)</option>
                      <option value={16}>16 线程 (高压负载测试)</option>
                    </select>
                  </div>

                  {/* Delay Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-primary" />
                        <span>防屏蔽翻页延时时间</span>
                      </label>
                      <span className="text-xs font-mono text-primary font-bold">{crawlInterval} ms</span>
                    </div>
                    <input
                      type="range"
                      min={1000}
                      max={10000}
                      step={500}
                      value={crawlInterval}
                      onChange={(e) => setCrawlInterval(Number(e.target.value))}
                      className="w-full h-1 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Proxy Gateway URL */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-primary" />
                    <span>代理网关网络服务器 URL</span>
                  </label>
                  <input
                    type="text"
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                    placeholder="输入代理地址，例如 http://127.0.0.1:7890"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    使用外置代理服务有助于彻底规避亚马逊 IP 爬行封锁。若保持空白，系统将直连本地 Internet 发起请求。
                  </p>
                </div>
              </div>
            )}

            {/* --- 4. AI LARGE MODEL SETTINGS --- */}
            {activeSection === 'ai' && (
              <div className="space-y-6 animate-fade-in">
                <div className="pb-4 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">AI 大模型服务配置</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    配置并集成第三方自然语言生成大模型与 Diffusion 生图引擎，用于智能挖掘商品核心痛点、生成转化文案及营销配图
                  </p>
                </div>

                {/* 1. Text Generation LLM */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-primary" />
                    <span>文本生成大模型 (Text LLM)</span>
                  </h4>
                  <div className="bg-slate-50/50 dark:bg-zinc-900/10 border border-border/80 rounded-xl p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                          <span>API Endpoint (接口代理端点)</span>
                        </label>
                        <input
                          type="text"
                          value={textApiEndpoint}
                          onChange={(e) => setTextApiEndpoint(e.target.value)}
                          placeholder="例如: https://api.deepseek.com/v1"
                          className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                          <span>模型名称 (Model Name)</span>
                        </label>
                        <input
                          type="text"
                          value={textModelName}
                          onChange={(e) => setTextModelName(e.target.value)}
                          placeholder="例如: deepseek-chat 或 gpt-4o"
                          className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                        <span>API 秘钥 (Secret API Key)</span>
                      </label>
                      <input
                        type="password"
                        value={textApiKey}
                        onChange={(e) => setTextApiKey(e.target.value)}
                        placeholder="请输入您的 AI API 访问令牌 (sk-••••)"
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Image Generation Diffusion Model */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-primary" />
                    <span>生图大模型 (Image Generator)</span>
                  </h4>
                  <div className="bg-slate-50/50 dark:bg-zinc-900/10 border border-border/80 rounded-xl p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                          <span>API Endpoint (生图接口端点)</span>
                        </label>
                        <input
                          type="text"
                          value={imageApiEndpoint}
                          onChange={(e) => setImageApiEndpoint(e.target.value)}
                          placeholder="例如: https://api.openai.com/v1"
                          className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                          <span>生图模型标识 (Model Identifier)</span>
                        </label>
                        <input
                          type="text"
                          value={imageModelName}
                          onChange={(e) => setImageModelName(e.target.value)}
                          placeholder="例如: dall-e-3 或 stable-diffusion-3"
                          className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                        <span>API 秘钥 (Secret API Key)</span>
                      </label>
                      <input
                        type="password"
                        value={imageApiKey}
                        onChange={(e) => setImageApiKey(e.target.value)}
                        placeholder="请输入生图服务 API 秘钥或 Local WebUI Token"
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- 4. ABOUT WORKSTATION --- */}
            {activeSection === 'about' && (
              <div className="space-y-6 animate-fade-in">
                <div className="pb-4 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">关于 SellerFlow</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    SellerFlow 多维跨境电商数据流式采集与决策沙盒桌面系统
                  </p>
                </div>

                {/* Beautiful Modern About Card with a smooth brand gradient border */}
                <div className="relative overflow-hidden p-6 rounded-2xl border border-primary/20 dark:border-primary/10 bg-slate-50/50 dark:bg-zinc-950/40 flex items-start gap-5 shadow-xs">
                  {/* Visual Left Accent Logo */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center text-white font-black text-3xl tracking-widest shadow-lg shadow-primary/20 shrink-0">
                    SF
                  </div>

                  {/* About Content */}
                  <div className="space-y-3.5 flex-1">
                    <div>
                      <h4 className="font-extrabold text-base text-slate-800 dark:text-slate-100">
                        SellerFlow Client 工作台
                      </h4>
                      <p className="text-[11px] text-primary font-mono mt-0.5">
                        Version 1.2.8 (Build 260531) • 稳定生产版本
                      </p>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      SellerFlow 是专门为跨境电商卖家定制的高速、多线程、多层级排行榜深度数据采集沙盒。底层搭载基于深度优先递归树爬网的多站点自适应抓取引擎，支持并轨实时卖家精灵指标数据回填，为您打通亚马逊排行榜选品最后一公里。
                    </p>

                    {/* Module Badges */}
                    <div className="flex flex-wrap gap-2 pt-1.5">
                      <span className="text-[10px] bg-slate-200/50 dark:bg-zinc-900 border border-border/80 px-2 py-0.5 rounded-full text-slate-600 dark:text-zinc-400 font-medium">
                        📥 分类拓扑树挖掘
                      </span>
                      <span className="text-[10px] bg-slate-200/50 dark:bg-zinc-900 border border-border/80 px-2 py-0.5 rounded-full text-slate-600 dark:text-zinc-400 font-medium">
                        🟩 Batch-100 并发进度网格
                      </span>
                      <span className="text-[10px] bg-slate-200/50 dark:bg-zinc-900 border border-border/80 px-2 py-0.5 rounded-full text-slate-600 dark:text-zinc-400 font-medium">
                        📊 卖家精灵多维指标回传
                      </span>
                    </div>

                    {/* Copyright footer */}
                    <div className="border-t border-border/60 pt-3 mt-3 text-[10px] text-muted-foreground flex justify-between">
                      <span>架构支撑: Electron v33.2.0 • React v19.0 • Vite v7.3</span>
                      <span>© 2026 SellerFlow Team. All rights reserved.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Persistent Floating Save Configuration Section (Pinned at the bottom right) */}
          <div className="flex items-center justify-between pt-5 border-t border-border mt-6">
            <div className="flex-1 flex items-center">
              {saveSuccess && (
                <div className="inline-flex items-center space-x-1.5 text-emerald-500 text-xs font-bold animate-fade-in">
                  <CheckCircle className="w-4 h-4" />
                  <span>控制台配置更新应用成功！</span>
                </div>
              )}
            </div>

            <button
              onClick={handleSave}
              className="inline-flex items-center justify-center space-x-2 bg-primary text-primary-foreground font-semibold px-6 py-2 rounded-md hover:bg-primary/95 transition-all duration-150 hover:-translate-y-[1px] active:translate-y-0 text-xs"
            >
              <CheckCircle className="w-4 h-4" />
              <span>保存当前配置</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  )
}
export default SettingsView
