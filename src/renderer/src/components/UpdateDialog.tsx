import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  X
} from 'lucide-react'
import { useAppUpdater } from '../hooks/useAppUpdater'

function formatBytes(bytes: number): string {
  if (!bytes) {
    return '0 MB'
  }

  const megabytes = bytes / 1024 / 1024
  return `${megabytes.toFixed(megabytes >= 10 ? 1 : 2)} MB`
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function normalizeReleaseNotesForDisplay(releaseNotes: string): string {
  if (!looksLikeHtml(releaseNotes)) {
    return releaseNotes
  }

  const htmlWithReadableBreaks = releaseNotes
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|section|article|header|footer|h[1-6]|li|ul|ol|blockquote|pre)>/gi, '\n')

  try {
    const document = new DOMParser().parseFromString(htmlWithReadableBreaks, 'text/html')
    const text = document.body.textContent || ''
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
  } catch {
    return htmlWithReadableBreaks
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
  }
}

export function UpdateDialog(): React.JSX.Element | null {
  const { state, checkForUpdates, downloadUpdate, quitAndInstall } = useAppUpdater()
  const [dismissedDialogKey, setDismissedDialogKey] = useState<string>()
  const [actionError, setActionError] = useState<string>()
  const dialogKey = `${state.status}:${state.updateInfo?.version || ''}:${state.revision}`
  const canShowDialog =
    state.status === 'available' ||
    state.status === 'downloading' ||
    state.status === 'downloaded' ||
    (state.status === 'error' && Boolean(state.updateInfo))

  if (!canShowDialog || dismissedDialogKey === dialogKey) {
    return null
  }

  const progressPercent = Math.min(100, Math.max(0, state.progress?.percent || 0))
  const error = actionError || state.error
  const releaseNotes = state.updateInfo?.releaseNotes
    ? normalizeReleaseNotesForDisplay(state.updateInfo.releaseNotes)
    : ''

  async function runAction(
    action: () => Promise<{ success: boolean; message?: string }>
  ): Promise<void> {
    setActionError(undefined)
    const result = await action()
    if (!result.success) {
      setActionError(result.message || '操作失败，请稍后重试。')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-5 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {state.status === 'downloaded' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : state.status === 'error' ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <Download className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {state.status === 'downloaded' ? '新版本已准备完成' : '发现 SellerFlow 新版本'}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                当前版本 v{state.currentVersion}
                {state.updateInfo?.version ? `，最新版本 v${state.updateInfo.version}` : ''}
              </p>
            </div>
          </div>

          {state.status !== 'downloading' && (
            <button
              onClick={() => setDismissedDialogKey(dialogKey)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="稍后处理"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-4 px-6 py-5">
          {releaseNotes && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                本次更新内容
              </h3>
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/35 p-3 text-xs leading-relaxed text-muted-foreground">
                {releaseNotes}
              </div>
            </div>
          )}

          {state.status === 'downloading' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">正在下载更新包</span>
                <span className="font-mono text-primary">{progressPercent.toFixed(1)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>
                  {formatBytes(state.progress?.transferred || 0)} /{' '}
                  {formatBytes(state.progress?.total || 0)}
                </span>
                <span>{formatBytes(state.progress?.bytesPerSecond || 0)}/s</span>
              </div>
            </div>
          )}

          {state.status === 'downloaded' && (
            <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-relaxed text-emerald-600 dark:text-emerald-400">
              更新包已经下载完成。你可以立即重启并完成安装，也可以稍后退出应用，SellerFlow
              会在退出时自动安装。
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs leading-relaxed text-red-600 dark:text-red-400">
              更新失败：{error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-6 py-4">
          {state.status !== 'downloading' && (
            <button
              onClick={() => setDismissedDialogKey(dialogKey)}
              className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              稍后处理
            </button>
          )}

          {state.status === 'available' && (
            <button
              onClick={() => void runAction(downloadUpdate)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              立即更新
            </button>
          )}

          {state.status === 'downloading' && (
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              下载中，请稍候
            </div>
          )}

          {state.status === 'downloaded' && (
            <button
              onClick={() => void runAction(quitAndInstall)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RotateCcw className="h-4 w-4" />
              立即重启安装
            </button>
          )}

          {state.status === 'error' && (
            <button
              onClick={() => void runAction(checkForUpdates)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" />
              重新检查
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
