import React, { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Router, ShieldAlert, Wifi, WifiOff } from 'lucide-react'
import type { MihomoProxyNode, MihomoRuntimeStatus } from '../../../shared/mihomo'

interface AppHeaderProps {
  breadcrumbs: string[]
}

function formatCooldown(isoTime?: string | null): string {
  if (!isoTime) return '无'

  const remainingMilliseconds = Date.parse(isoTime) - Date.now()
  if (!Number.isFinite(remainingMilliseconds) || remainingMilliseconds <= 0) return '即将恢复'

  const totalSeconds = Math.ceil(remainingMilliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}分${String(seconds).padStart(2, '0')}秒` : `${seconds}秒`
}

function getScopeLabel(scope: 'category' | 'detail'): string {
  return scope === 'category' ? '分类/翻页' : '商品详情'
}

function getNodeScopeCooldown(
  node: MihomoProxyNode,
  scope: 'category' | 'detail'
): string | null | undefined {
  return scope === 'category' ? node.categoryCooldownUntil : node.detailCooldownUntil
}

function getNodeScopeReason(node: MihomoProxyNode, scope: 'category' | 'detail'): string {
  return scope === 'category' ? node.categoryCooldownReason || '' : node.detailCooldownReason || ''
}

function getNodeScopeFailureCount(node: MihomoProxyNode, scope: 'category' | 'detail'): number {
  return scope === 'category'
    ? node.categoryNetworkFailCount || 0
    : node.detailNetworkFailCount || 0
}

export const AppHeader: React.FC<AppHeaderProps> = ({ breadcrumbs }) => {
  const [mihomoStatus, setMihomoStatus] = useState<MihomoRuntimeStatus | null>(null)
  const [mihomoNodes, setMihomoNodes] = useState<MihomoProxyNode[]>([])
  const [isNodePanelOpen, setIsNodePanelOpen] = useState(false)

  const refreshMihomoState = async (): Promise<void> => {
    try {
      const [status, nodes] = await Promise.all([
        window.api.mihomo.getStatus(),
        window.api.mihomo.listNodes()
      ])
      setMihomoStatus(status)
      setMihomoNodes(nodes)
    } catch {
      setMihomoStatus(null)
      setMihomoNodes([])
    }
  }

  useEffect(() => {
    void refreshMihomoState()
    const timer = window.setInterval(() => void refreshMihomoState(), 5000)
    return () => window.clearInterval(timer)
  }, [])

  const currentNodes = useMemo(
    () => mihomoNodes.filter((node) => node.currentScopes?.length),
    [mihomoNodes]
  )
  const healthyNodeCount = mihomoNodes.filter((node) => node.alive).length
  const coolingNodeCount = mihomoNodes.filter(
    (node) => node.categoryCooldownUntil || node.detailCooldownUntil || node.cooldownUntil
  ).length
  const cardTitle = !mihomoStatus?.enabled
    ? '代理池未启用'
    : currentNodes.length > 0
      ? currentNodes
          .flatMap((node) =>
            (node.currentScopes || []).map((scope) => `${getScopeLabel(scope)}：${node.name}`)
          )
          .join(' / ')
      : mihomoStatus.running
        ? `节点池运行中，可用 ${healthyNodeCount}/${mihomoStatus.nodeCount}`
        : '节点池未运行'

  return (
    <header className="h-14 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between px-6 flex-shrink-0 shadow-sm mt-4 mr-4 ml-4">
      {/* Breadcrumb Info */}
      <div className="flex items-center space-x-2 text-xs font-semibold">
        <span className="text-muted-foreground hover:text-slate-700 transition-colors">
          SellerFlow
        </span>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            <span className="text-slate-300 dark:text-zinc-700">/</span>
            <span
              className={
                idx === breadcrumbs.length - 1
                  ? 'text-primary'
                  : 'text-slate-600 dark:text-zinc-400'
              }
            >
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Quick Stats Panel */}
      <div className="flex items-center space-x-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsNodePanelOpen((open) => !open)
              void refreshMihomoState()
            }}
            className="inline-flex max-w-[420px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-slate-800 dark:bg-zinc-900/70"
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                mihomoStatus?.enabled && mihomoStatus.running
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-slate-200 text-slate-500 dark:bg-zinc-800'
              }`}
            >
              {mihomoStatus?.enabled && mihomoStatus.running ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold text-foreground">
                {cardTitle}
              </span>
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                代理节点状态 · 冷却 {coolingNodeCount} · 可用 {healthyNodeCount}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>

          {isNodePanelOpen && (
            <div className="absolute right-0 top-12 z-50 w-[560px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Router className="h-4 w-4 text-primary" />
                  <div>
                    <h3 className="text-xs font-bold text-foreground">Mihomo 节点池状态</h3>
                    <p className="text-[10px] text-muted-foreground">
                      {mihomoStatus?.running
                        ? `运行中，节点 ${mihomoStatus.nodeCount} 个`
                        : mihomoStatus?.enabled
                          ? `未运行：${mihomoStatus.error || '暂无错误信息'}`
                          : '代理池未启用'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshMihomoState()}
                  className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  刷新
                </button>
              </div>

              <div className="max-h-[420px] overflow-y-auto p-3">
                {mihomoNodes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    暂无节点数据。请在设置页启用 Mihomo 节点池并刷新订阅。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mihomoNodes.map((node) => {
                      const isCurrent = Boolean(node.currentScopes?.length)
                      return (
                        <div
                          key={node.id}
                          className={`rounded-xl border p-3 text-xs ${
                            isCurrent
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-border bg-background/70'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate font-bold text-foreground">
                                  {node.name}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 dark:bg-zinc-900">
                                  {node.type}
                                </span>
                                {node.currentScopes?.map((scope) => (
                                  <span
                                    key={scope}
                                    className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary"
                                  >
                                    当前 {getScopeLabel(scope)}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                                <span>端口 {node.localPort}</span>
                                <span>延迟 {node.latency ? `${node.latency}ms` : '未测速'}</span>
                                <span>失败 {node.failCount}</span>
                                <span className={node.alive ? 'text-emerald-500' : 'text-rose-500'}>
                                  {node.alive ? '健康' : '不可用'}
                                </span>
                              </div>
                            </div>
                            {(node.categoryCooldownUntil || node.detailCooldownUntil) && (
                              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
                            )}
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {(['category', 'detail'] as const).map((scope) => {
                              const cooldown = getNodeScopeCooldown(node, scope)
                              const reason = getNodeScopeReason(node, scope)
                              return (
                                <div
                                  key={scope}
                                  className="rounded-lg border border-border/70 bg-muted/20 p-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-foreground">
                                      {getScopeLabel(scope)}
                                    </span>
                                    <span
                                      className={`text-[10px] font-semibold ${
                                        cooldown ? 'text-amber-500' : 'text-emerald-500'
                                      }`}
                                    >
                                      {cooldown ? `冷却 ${formatCooldown(cooldown)}` : '可用'}
                                    </span>
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                                    {reason ||
                                      `网络失败 ${getNodeScopeFailureCount(node, scope)} 次，暂无冷却原因。`}
                                  </p>
                                </div>
                              )
                            })}
                          </div>

                          {node.lastError && (
                            <p className="mt-2 line-clamp-2 text-[10px] text-rose-500">
                              最近错误：{node.lastError}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="inline-flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            核心主线程运行中
          </span>
        </div>
      </div>
    </header>
  )
}
