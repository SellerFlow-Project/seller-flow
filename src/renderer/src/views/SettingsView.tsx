import React, { useEffect, useState } from 'react'
import {
  Sun,
  Moon,
  Settings,
  Sliders,
  CheckCircle,
  Bell,
  Mail,
  Info,
  Server,
  Check,
  Trash2,
  Brain,
  Cpu,
  Image as ImageIcon,
  RefreshCw
} from 'lucide-react'
import {
  DEFAULT_SELLER_FLOW_SETTINGS,
  type AiSettings,
  type ApplicationSettings,
  type CrawlingSettings,
  type NotificationSettings,
  type SellerFlowSettings,
  type ThemeColor,
  type UiScaleMode
} from '../../../shared/settings'
import type { AppUpdateState } from '../../../shared/update'
import { useAppStore } from '../store/appStore'
import { useAppUpdater } from '../hooks/useAppUpdater'

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
        <label
          className="text-sm font-semibold text-foreground select-none cursor-pointer"
          onClick={() => onChange(!checked)}
        >
          {label}
        </label>
        {description && (
          <p className="text-[11px] text-muted-foreground leading-normal">{description}</p>
        )}
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

function getUpdateMessage(state: AppUpdateState): string {
  if (state.status === 'checking') {
    return '正在检查更新...'
  }

  if (state.status === 'not-available') {
    return '当前已经是最新版本。'
  }

  if (state.status === 'available') {
    return `发现新版本 v${state.updateInfo?.version || ''}，请在弹框中确认更新。`
  }

  if (state.status === 'downloaded') {
    return '新版本已下载完成，等待重启安装。'
  }

  if (state.status === 'error') {
    return `检查更新失败：${state.error || '请稍后重试。'}`
  }

  return ''
}

export const SettingsView: React.FC = () => {
  const { activeTab, applyApplicationSettings } = useAppStore()
  const { state: updateState, checkForUpdates } = useAppUpdater()

  // Setting sections tabs
  const [activeSection, setActiveSection] = useState<
    'app' | 'notifications' | 'crawling' | 'ai' | 'sharing' | 'about'
  >('app')
  const [isServerEnabled, setIsServerEnabled] = useState(false)
  const [draftSettings, setDraftSettings] = useState<SellerFlowSettings>(() =>
    structuredClone(DEFAULT_SELLER_FLOW_SETTINGS)
  )
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [updateActionError, setUpdateActionError] = useState('')

  useEffect(() => {
    if (activeTab !== 'settings') {
      return
    }

    let active = true

    void window.api.settings
      .get()
      .then((settings) => {
        if (active) {
          setDraftSettings(settings)
          setSaveError('')
        }
      })
      .catch((error) => {
        if (active) {
          setSaveError(`读取本地配置失败：${String(error)}`)
        }
      })

    return () => {
      active = false
    }
  }, [activeTab])

  const updateApplicationDraft = (settings: Partial<ApplicationSettings>): void => {
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      application: {
        ...currentSettings.application,
        ...settings
      }
    }))
  }

  const updateNotificationDraft = (settings: Partial<NotificationSettings>): void => {
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      notifications: {
        ...currentSettings.notifications,
        ...settings
      }
    }))
  }

  const updateCrawlingDraft = (settings: Partial<CrawlingSettings>): void => {
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      crawling: {
        ...currentSettings.crawling,
        ...settings
      }
    }))
  }

  const updateAiDraft = (settings: Partial<AiSettings>): void => {
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      ai: {
        ...currentSettings.ai,
        ...settings
      }
    }))
  }

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)
    setSaveError('')

    try {
      const savedSettings = await window.api.settings.save(draftSettings)
      setDraftSettings(savedSettings)
      applyApplicationSettings(savedSettings.application)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (error) {
      setSaveError(`保存本地配置失败：${String(error)}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCheckForUpdates = async (): Promise<void> => {
    setUpdateActionError('')
    const result = await checkForUpdates()
    if (!result.success) {
      setUpdateActionError(result.message || '检查更新失败，请稍后重试。')
    }
  }

  // Swatch colors utility
  const colorSwatches = [
    { key: 'blue', bg: 'bg-blue-500', border: 'border-blue-400', name: '经典科技蓝' },
    { key: 'emerald', bg: 'bg-emerald-500', border: 'border-emerald-400', name: '生机翡翠绿' },
    { key: 'violet', bg: 'bg-violet-500', border: 'border-violet-400', name: '极客魔力紫' },
    { key: 'amber', bg: 'bg-amber-500', border: 'border-amber-400', name: '明朗温暖黄' },
    { key: 'rose', bg: 'bg-rose-500', border: 'border-rose-400', name: '活力樱桃红' }
  ] as const

  const { application, notifications, crawling, ai } = draftSettings
  const updateMessage = getUpdateMessage(updateState) || updateActionError

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
              onClick={() => setActiveSection('sharing')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
                activeSection === 'sharing'
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100/50 dark:hover:bg-zinc-900/40'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>数据共享配置</span>
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
            <span className="font-bold text-slate-700 dark:text-zinc-300 block mb-0.5">
              本地沙盒架构保证
            </span>
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
                      onClick={() => updateApplicationDraft({ theme: 'light' })}
                      className={`flex items-center justify-center space-x-2.5 p-3 rounded-lg border text-xs font-semibold transition-all ${
                        application.theme === 'light'
                          ? 'border-primary bg-primary/5 text-primary shadow-xs'
                          : 'border-border bg-background hover:bg-slate-50 dark:hover:bg-zinc-900 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      <span>明亮白模式 (Light Mode)</span>
                    </button>
                    <button
                      onClick={() => updateApplicationDraft({ theme: 'dark' })}
                      className={`flex items-center justify-center space-x-2.5 p-3 rounded-lg border text-xs font-semibold transition-all ${
                        application.theme === 'dark'
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
                      const isSelected = application.themeColor === color.key
                      return (
                        <button
                          key={color.key}
                          onClick={() =>
                            updateApplicationDraft({ themeColor: color.key as ThemeColor })
                          }
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${color.bg} ${
                            isSelected
                              ? 'ring-4 ring-offset-2 ring-primary dark:ring-offset-black scale-110 shadow-md'
                              : 'hover:scale-105'
                          }`}
                          title={color.name}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white font-bold" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* UI Scale Config */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    界面全局缩放 (UI Scale)
                  </label>
                  <p className="text-[11px] text-muted-foreground leading-normal mb-3">
                    针对高分辨率显示器，自动计算或手动调节界面的缩放比例（原生无损缩放）：
                  </p>
                  <select
                    value={application.uiScale}
                    onChange={(e) =>
                      updateApplicationDraft({ uiScale: e.target.value as UiScaleMode })
                    }
                    className="w-full md:w-1/2 bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="auto">自动适应显示器分辨率 (推荐)</option>
                    <option value="0.8">80% - 紧凑</option>
                    <option value="0.9">90% - 偏小</option>
                    <option value="1.0">100% - 标准</option>
                    <option value="1.1">110% - 偏大</option>
                    <option value="1.2">120% - 较大</option>
                    <option value="1.5">150% - 特大</option>
                  </select>
                </div>
              </div>
            )}

            {/* --- 2. NOTIFICATION SETTINGS --- */}
            {activeSection === 'notifications' && (
              <div className="space-y-6 animate-fade-in">
                <div className="pb-4 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">通知服务设置</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    配置第三方邮件传输协议
                    (SMTP)，供采集任务在成功或失败时自动向指定邮箱发送详情报表
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
                        value={notifications.smtpHost}
                        onChange={(e) => updateNotificationDraft({ smtpHost: e.target.value })}
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
                        value={notifications.smtpPort}
                        onChange={(e) => updateNotificationDraft({ smtpPort: e.target.value })}
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
                        value={notifications.smtpUser}
                        onChange={(e) => updateNotificationDraft({ smtpUser: e.target.value })}
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
                        value={notifications.smtpPass}
                        onChange={(e) => updateNotificationDraft({ smtpPass: e.target.value })}
                        placeholder="请输入 SMTP 客户端授权密码或 Token"
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
                      checked={notifications.notifySuccess}
                      onChange={(notifySuccess) => updateNotificationDraft({ notifySuccess })}
                      label="任务成功通知 (On Task Success)"
                      description="当分类深度 DFS 排行榜爬行任务以及并轨详情并发提取成功完结时，自动向您的发件人账号/设定收件箱内推送详细的汇总统计与已入库商品 SKU 数量报告。"
                    />
                    <ToggleSwitch
                      checked={notifications.notifyFailure}
                      onChange={(notifyFailure) => updateNotificationDraft({ notifyFailure })}
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
                      checked={crawling.clearHistoryOnNewTask}
                      onChange={(clearHistoryOnNewTask) =>
                        updateCrawlingDraft({ clearHistoryOnNewTask })
                      }
                      label="每次新建任务都清空历史任务数据"
                      description="开启此策略后，每次当您点击“开启亚马逊采集”来执行新任务时，系统会自动清空数据库本地缓冲的旧商品记录，保证全新任务只显示干净的对应商品数据。若关闭此策略，数据会做增量增补插入。"
                    />
                  </div>
                </div>

                {/* Concurrency and Delay Configs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Concurrency Count */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-primary" />
                      <span>并发数</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={crawling.concurrencyCount}
                      onChange={(e) =>
                        updateCrawlingDraft({ concurrencyCount: Number(e.target.value) })
                      }
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                    />
                  </div>

                  {/* Random Delay */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-primary" />
                      <span>随机延时区间 (秒)</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min={0}
                        placeholder="最小延时"
                        value={crawling.minDelay}
                        onChange={(e) => updateCrawlingDraft({ minDelay: Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono text-center"
                      />
                      <span className="text-muted-foreground text-xs font-bold">-</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="最大延时"
                        value={crawling.maxDelay}
                        onChange={(e) => updateCrawlingDraft({ maxDelay: Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- 4. AI LARGE MODEL SETTINGS --- */}
            {activeSection === 'ai' && (
              <div className="space-y-6 animate-fade-in">
                <div className="pb-4 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">AI 大模型服务配置</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    配置并集成第三方自然语言生成大模型与 Diffusion
                    生图引擎，用于智能挖掘商品核心痛点、生成转化文案及营销配图
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
                          value={ai.textApiEndpoint}
                          onChange={(e) => updateAiDraft({ textApiEndpoint: e.target.value })}
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
                          value={ai.textModelName}
                          onChange={(e) => updateAiDraft({ textModelName: e.target.value })}
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
                        value={ai.textApiKey}
                        onChange={(e) => updateAiDraft({ textApiKey: e.target.value })}
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
                          value={ai.imageApiEndpoint}
                          onChange={(e) => updateAiDraft({ imageApiEndpoint: e.target.value })}
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
                          value={ai.imageModelName}
                          onChange={(e) => updateAiDraft({ imageModelName: e.target.value })}
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
                        value={ai.imageApiKey}
                        onChange={(e) => updateAiDraft({ imageApiKey: e.target.value })}
                        placeholder="请输入生图服务 API 秘钥或 Local WebUI Token"
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- 5. DATA SHARING SETTINGS --- */}
            {activeSection === 'sharing' && (
              <div className="space-y-6 animate-fade-in">
                <div className="pb-4 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">数据共享配置</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    配置当前客户端的局域网共享模式与联机浏览数据源权限
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-zinc-900/20 border border-border/80 rounded-xl px-4 py-1">
                  <ToggleSwitch
                    checked={isServerEnabled}
                    onChange={setIsServerEnabled}
                    label="将本机作为服务端"
                    description="启用后，本机将作为服务器端，同局域网内的其它客户端可以扫描发现并连接到当前客户端，且其它客户端可以实时浏览本机已采集的所有数据。"
                  />
                </div>
              </div>
            )}

            {/* --- 6. ABOUT WORKSTATION --- */}
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
                        Version {updateState.currentVersion} • 稳定生产版本
                      </p>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      SellerFlow
                      是专门为跨境电商卖家定制的高速、多线程、多层级排行榜深度数据采集沙盒。底层搭载基于深度优先递归树爬网的多站点自适应抓取引擎，支持并轨实时卖家精灵指标数据回填，为您打通亚马逊排行榜选品最后一公里。
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => void handleCheckForUpdates()}
                        disabled={
                          updateState.status === 'checking' ||
                          updateState.status === 'downloading' ||
                          updateState.status === 'downloaded'
                        }
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${updateState.status === 'checking' ? 'animate-spin' : ''}`}
                        />
                        检查更新
                      </button>
                      {updateMessage && (
                        <span className="text-[11px] leading-relaxed text-muted-foreground">
                          {updateMessage}
                        </span>
                      )}
                    </div>

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
          {activeSection !== 'sharing' && (
            <div className="flex items-center justify-between pt-5 border-t border-border mt-6">
              <div className="flex-1 flex items-center">
                {saveSuccess && (
                  <div className="inline-flex items-center space-x-1.5 text-emerald-500 text-xs font-bold animate-fade-in">
                    <CheckCircle className="w-4 h-4" />
                    <span>控制台配置更新应用成功！</span>
                  </div>
                )}
                {saveError && <span className="text-xs font-semibold text-red-500">{saveError}</span>}
              </div>

              <button
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="inline-flex items-center justify-center space-x-2 bg-primary text-primary-foreground font-semibold px-6 py-2 rounded-md hover:bg-primary/95 transition-all duration-150 hover:-translate-y-[1px] active:translate-y-0 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isSaving ? '正在保存...' : '保存当前配置'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default SettingsView
