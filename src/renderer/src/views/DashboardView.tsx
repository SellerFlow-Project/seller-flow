import React from 'react'
import {
  Cpu,
  FileSpreadsheet,
  Bot,
  ArrowRight,
  Network,
  Sparkles,
  ChevronRight,
  Activity
} from 'lucide-react'
import { useAppStore } from '../store/appStore'

export const DashboardView: React.FC = () => {
  const { setTab } = useAppStore()

  return (
    <div className="p-6 space-y-6 flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-black">
      {/* Dynamic Keyframe Animations for SVG flow lines */}
      <style>{`
        @keyframes flow-line {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animated-flow-line {
          stroke-dasharray: 6, 4;
          animation: flow-line 0.8s linear infinite;
        }
      `}</style>

      {/* Top Banner Card */}
      <div className="bg-card text-card-foreground border border-border rounded-lg p-6 flex flex-col justify-between transition-all-200 hover:border-primary/20">
        <div>
          <h2 className="text-xl font-extrabold text-foreground flex items-center space-x-2">
            <Activity className="w-5 h-5 text-primary animate-pulse" />
            <span>智能跨境电商工作流看板</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-2xl">
            欢迎使用
            SellerFlow！以下是为您定制的自动化商品流闭环。点击下方流程图中的各个核心处理节点，即可快速跳转到对应的业务界面展开工作。
          </p>
        </div>
      </div>

      {/* Main Flowchart Card */}
      <div className="bg-card text-card-foreground border border-border rounded-lg p-10 flex-1 flex flex-col items-center justify-center transition-all-200 hover:border-primary/20 min-h-[450px] relative overflow-hidden">
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(128,128,128,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        {/* Outer Layout container */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-11 gap-4 items-center relative z-10">
          {/* Node 1: Left Node - Data Collection (数据采集) */}
          <div className="md:col-span-4 flex justify-center">
            <button
              onClick={() => setTab('amazon-collection')}
              className="w-full max-w-xs text-left bg-background border border-border rounded-xl p-5 hover:border-primary hover:bg-primary/[0.02] group transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-center space-x-3.5 mb-3">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                    数据入口 (Source)
                  </span>
                  <h3 className="font-bold text-sm text-foreground">数据采集</h3>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-normal mb-4">
                采集排行榜商品数据、关键词筛选等等。
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-border text-[11px] font-bold text-primary">
                <span>进入亚马逊排行榜</span>
                <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>

          {/* Connectors: Middle Connectors (SVG Flowchart arrows) */}
          <div className="md:col-span-3 h-48 md:h-full flex items-center justify-center relative">
            {/* Desktop SVG Connector Paths */}
            <svg
              className="hidden md:block w-full h-48 overflow-visible absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {/* Path 1: Left center to upper-right */}
              <path
                d="M 5,50 C 35,50 35,20 95,20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-slate-200 dark:text-slate-800"
              />
              <path
                d="M 5,50 C 35,50 35,20 95,20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-primary animated-flow-line"
              />

              {/* Path 2: Left center to lower-right */}
              <path
                d="M 5,50 C 35,50 35,80 95,80"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-slate-200 dark:text-slate-800"
              />
              <path
                d="M 5,50 C 35,50 35,80 95,80"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-primary animated-flow-line"
              />
            </svg>

            {/* Mobile layout indicator */}
            <div className="md:hidden flex flex-col items-center justify-center space-y-4">
              <ArrowRight className="w-5 h-5 text-primary rotate-90" />
            </div>

            <div className="absolute hidden md:flex items-center justify-center p-2 rounded-full border border-border bg-card text-muted-foreground">
              <Network className="w-4 h-4 text-primary animate-pulse" />
            </div>
          </div>

          {/* Right Nodes: Vertical Stack of Targets */}
          <div className="md:col-span-4 flex flex-col space-y-6 justify-center">
            {/* Node 2: Top Right - Data Management (数据管理) */}
            <button
              onClick={() => setTab('data-browsing')}
              className="w-full max-w-xs text-left bg-background border border-border rounded-xl p-5 hover:border-primary hover:bg-primary/[0.02] group transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-center space-x-3.5 mb-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                    本地存储 (Storage)
                  </span>
                  <h3 className="font-bold text-sm text-foreground">数据管理</h3>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-normal mb-4">
                商品库多维搜索与批量筛选。提供一键导出为 CSV 备份，或执行数据瘦身与历史清理。
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-border text-[11px] font-bold text-blue-500">
                <span>进入数据浏览</span>
                <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Node 3: Bottom Right - AI Processing (AI处理) */}
            <button
              onClick={() => setTab('ai-functions')}
              className="w-full max-w-xs text-left bg-background border border-border rounded-xl p-5 hover:border-primary hover:bg-primary/[0.02] group transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-center space-x-3.5 mb-3">
                <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                    智能重塑 (Intelligence)
                  </span>
                  <h3 className="font-bold text-sm text-foreground">AI 处理</h3>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-normal mb-4">
                连接大语言模型，将采集出的商品参数与卖点智能改写为高转化率的亚马逊 Listing
                标题与五点描述。
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-border text-[11px] font-bold text-indigo-500">
                <span>进入AI功能</span>
                <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>

        {/* Footer Hint */}
        <div className="mt-8 text-[11px] text-muted-foreground flex items-center space-x-1">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>点击对应节点卡片即可触发路由跳转并自动展开左侧导航，体验完整闭环流程。</span>
        </div>
      </div>
    </div>
  )
}
