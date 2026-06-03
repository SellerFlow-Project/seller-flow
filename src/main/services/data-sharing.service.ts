import { app } from 'electron'
import express, { type Express, type Request, type Response } from 'express'
import { createServer, type Server } from 'http'
import { networkInterfaces } from 'os'
import Bonjour from 'bonjour-service'
import {
  DATA_SHARING_API_PREFIX,
  DATA_SHARING_PROTOCOL_VERSION,
  DATA_SHARING_SERVICE_TYPE,
  type DataSharingProductQueryFilter,
  type DataSharingStatus,
  type SharedDataSource
} from '../../shared/data-sharing'
import type { DataSharingSettings } from '../../shared/settings'
import { databaseService } from './database.service'

const DISCOVERY_TIMEOUT_MS = 2500
const REMOTE_REQUEST_TIMEOUT_MS = 8000
const LOCALHOST = '127.0.0.1'

type BonjourService = InstanceType<typeof Bonjour.Service>
type BonjourBrowser = InstanceType<typeof Bonjour.Browser>

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : fallback
  }

  return fallback
}

function getLocalIPv4Address(): string {
  const interfaces = networkInterfaces()

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address
      }
    }
  }

  return LOCALHOST
}

function createBaseUrl(host: string, port: number): string {
  return `http://${host}:${port}${DATA_SHARING_API_PREFIX}`
}

function normalizeRemoteBaseUrl(source: SharedDataSource): string {
  return source.baseUrl.replace(/\/+$/, '')
}

function sendJsonError(res: Response, error: unknown): void {
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : '数据共享服务处理请求失败。'
  })
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REMOTE_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`远端数据源请求失败 (${response.status})`)
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

class DataSharingService {
  private settings: DataSharingSettings | null = null
  private app: Express | null = null
  private server: Server | null = null
  private bonjour: Bonjour | null = null
  private publishedService: BonjourService | null = null
  private runningPort: number | null = null
  private lastError = ''

  public async applySettings(settings: DataSharingSettings): Promise<DataSharingStatus> {
    this.settings = settings
    this.lastError = ''

    if (!settings.serverEnabled) {
      await this.stopServer()
      return this.getStatus()
    }

    try {
      await this.startServer(settings)
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : '启动数据共享服务失败。'
      await this.stopServer()
    }

    return this.getStatus()
  }

  public getStatus(): DataSharingStatus {
    const settings = this.ensureSettings()
    const host = getLocalIPv4Address()

    return {
      enabled: settings.serverEnabled,
      running: Boolean(this.server && this.runningPort),
      port: this.runningPort,
      baseUrl: this.runningPort ? createBaseUrl(host, this.runningPort) : null,
      deviceId: settings.deviceId,
      displayName: settings.displayName,
      error: this.lastError || undefined
    }
  }

  public async discoverSources(): Promise<SharedDataSource[]> {
    const settings = this.ensureSettings()
    const bonjour = new Bonjour(undefined, (error: Error) => {
      console.warn('[DataSharing] mDNS 扫描异常:', error.message)
    })
    const sources = new Map<string, SharedDataSource>()
    let browser: BonjourBrowser | null = null

    try {
      browser = bonjour.find({ type: DATA_SHARING_SERVICE_TYPE }, (service) => {
        const source = this.createDataSourceFromBonjourService(service, settings.deviceId)
        if (source) {
          sources.set(source.id, source)
        }
      })

      await new Promise<void>((resolve) => {
        setTimeout(resolve, DISCOVERY_TIMEOUT_MS)
        browser?.update()
      })

      for (const service of browser.services) {
        const source = this.createDataSourceFromBonjourService(service, settings.deviceId)
        if (source) {
          sources.set(source.id, source)
        }
      }
    } finally {
      browser?.stop()
      bonjour.destroy()
    }

    return Array.from(sources.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  public async getRemoteTasks(source: SharedDataSource): Promise<unknown[]> {
    const response = await fetchJson<{ success: boolean; list?: unknown[]; error?: string }>(
      `${normalizeRemoteBaseUrl(source)}/tasks`
    )

    if (!response.success) {
      throw new Error(response.error || '远端任务列表读取失败。')
    }

    return response.list || []
  }

  public async getRemoteCategories(source: SharedDataSource, taskId: number): Promise<string[]> {
    const response = await fetchJson<{ success: boolean; list?: string[]; error?: string }>(
      `${normalizeRemoteBaseUrl(source)}/tasks/${taskId}/categories`
    )

    if (!response.success) {
      throw new Error(response.error || '远端分类列表读取失败。')
    }

    return response.list || []
  }

  public async getRemoteSellerTypes(source: SharedDataSource, taskId: number): Promise<string[]> {
    const response = await fetchJson<{ success: boolean; list?: string[]; error?: string }>(
      `${normalizeRemoteBaseUrl(source)}/tasks/${taskId}/seller-types`
    )

    if (!response.success) {
      throw new Error(response.error || '远端配送方式读取失败。')
    }

    return response.list || []
  }

  public async queryRemoteProducts(
    source: SharedDataSource,
    filter: DataSharingProductQueryFilter
  ): Promise<{ total: number; list: unknown[] }> {
    const response = await fetchJson<{
      success: boolean
      total?: number
      list?: unknown[]
      error?: string
    }>(`${normalizeRemoteBaseUrl(source)}/products/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(filter)
    })

    if (!response.success) {
      throw new Error(response.error || '远端商品数据读取失败。')
    }

    return {
      total: response.total || 0,
      list: response.list || []
    }
  }

  public async getRemoteProductBsrRanks(
    source: SharedDataSource,
    productId: number
  ): Promise<unknown[]> {
    const response = await fetchJson<{ success: boolean; list?: unknown[]; error?: string }>(
      `${normalizeRemoteBaseUrl(source)}/products/${productId}/bsr-ranks`
    )

    if (!response.success) {
      throw new Error(response.error || '远端 BSR 榜单读取失败。')
    }

    return response.list || []
  }

  public async markRemoteProductAsRead(
    source: SharedDataSource,
    productId: number
  ): Promise<boolean> {
    const response = await fetchJson<{ success: boolean; updated?: boolean; error?: string }>(
      `${normalizeRemoteBaseUrl(source)}/products/${productId}/read`,
      {
        method: 'PATCH'
      }
    )

    if (!response.success) {
      throw new Error(response.error || '远端商品已读状态更新失败。')
    }

    return Boolean(response.updated)
  }

  private ensureSettings(): DataSharingSettings {
    if (this.settings) {
      return this.settings
    }

    return {
      serverEnabled: false,
      serverPort: 48991,
      deviceId: 'unknown',
      displayName: 'SellerFlow 数据服务'
    }
  }

  private async startServer(settings: DataSharingSettings): Promise<void> {
    if (this.server && this.runningPort) {
      await this.stopServer()
    }

    this.app = this.createExpressApp(settings)
    this.server = createServer(this.app)

    await this.listen(settings.serverPort)
    this.publishBonjourService(settings)
  }

  private listen(port: number): Promise<void> {
    const targetPort = port > 0 ? port : 0

    return new Promise((resolve, reject) => {
      const server = this.server
      if (!server) {
        reject(new Error('数据共享 HTTP 服务尚未创建。'))
        return
      }

      const handleError = (error: NodeJS.ErrnoException): void => {
        server.off('listening', handleListening)
        if (error.code === 'EADDRINUSE' && targetPort !== 0) {
          server.listen(0, '0.0.0.0')
          server.once('error', reject)
          server.once('listening', handleListening)
          return
        }
        reject(error)
      }

      const handleListening = (): void => {
        server.off('error', handleError)
        const address = server.address()
        this.runningPort = typeof address === 'object' && address ? address.port : null
        resolve()
      }

      server.once('error', handleError)
      server.once('listening', handleListening)
      server.listen(targetPort, '0.0.0.0')
    })
  }

  private createExpressApp(settings: DataSharingSettings): Express {
    const api = express()
    api.use(express.json({ limit: '1mb' }))

    api.get(`${DATA_SHARING_API_PREFIX}/health`, (_req, res) => {
      res.json({
        success: true,
        app: 'seller-flow',
        protocolVersion: DATA_SHARING_PROTOCOL_VERSION,
        deviceId: settings.deviceId,
        displayName: settings.displayName
      })
    })

    api.get(`${DATA_SHARING_API_PREFIX}/tasks`, (_req, res) => {
      try {
        res.json({ success: true, list: databaseService.queryTasks() })
      } catch (error) {
        sendJsonError(res, error)
      }
    })

    api.get(`${DATA_SHARING_API_PREFIX}/tasks/:taskId/categories`, (req, res) => {
      try {
        res.json({
          success: true,
          list: databaseService.queryCategories(toNumber(req.params.taskId, 0))
        })
      } catch (error) {
        sendJsonError(res, error)
      }
    })

    api.get(`${DATA_SHARING_API_PREFIX}/tasks/:taskId/seller-types`, (req, res) => {
      try {
        res.json({
          success: true,
          list: databaseService.querySellerTypes(toNumber(req.params.taskId, 0))
        })
      } catch (error) {
        sendJsonError(res, error)
      }
    })

    api.post(`${DATA_SHARING_API_PREFIX}/products/query`, (req: Request, res: Response) => {
      try {
        res.json({
          success: true,
          ...databaseService.queryProducts(req.body as DataSharingProductQueryFilter)
        })
      } catch (error) {
        sendJsonError(res, error)
      }
    })

    api.get(`${DATA_SHARING_API_PREFIX}/products/:productId/bsr-ranks`, (req, res) => {
      try {
        res.json({
          success: true,
          list: databaseService.queryProductBsrRanks(toNumber(req.params.productId, 0))
        })
      } catch (error) {
        sendJsonError(res, error)
      }
    })

    api.patch(`${DATA_SHARING_API_PREFIX}/products/:productId/read`, (req, res) => {
      try {
        res.json({
          success: true,
          updated: databaseService.markProductAsRead(toNumber(req.params.productId, 0))
        })
      } catch (error) {
        sendJsonError(res, error)
      }
    })

    return api
  }

  private publishBonjourService(settings: DataSharingSettings): void {
    if (!this.runningPort) {
      return
    }

    this.bonjour = new Bonjour(undefined, (error: Error) => {
      console.warn('[DataSharing] mDNS 广播异常:', error.message)
    })
    this.publishedService = this.bonjour.publish({
      name: settings.displayName || `${app.getName()} 数据服务`,
      type: DATA_SHARING_SERVICE_TYPE,
      port: this.runningPort,
      txt: {
        app: 'seller-flow',
        protocolVersion: DATA_SHARING_PROTOCOL_VERSION,
        deviceId: settings.deviceId,
        displayName: settings.displayName
      }
    })
  }

  private createDataSourceFromBonjourService(
    service: BonjourService,
    localDeviceId: string
  ): SharedDataSource | null {
    const txt = service.txt || {}
    const deviceId = typeof txt.deviceId === 'string' ? txt.deviceId : ''

    if (txt.app !== 'seller-flow' || !deviceId || deviceId === localDeviceId) {
      return null
    }

    const host =
      (service.addresses || []).find((address) => /^\d+\.\d+\.\d+\.\d+$/.test(address)) ||
      service.referer?.address ||
      service.host

    if (!host || !service.port) {
      return null
    }

    const displayName = typeof txt.displayName === 'string' ? txt.displayName : service.name

    return {
      id: `${deviceId}-${host}-${service.port}`,
      name: displayName || service.name,
      host,
      hostname: service.host,
      port: service.port,
      baseUrl: createBaseUrl(host, service.port),
      deviceId,
      lastSeenAt: new Date().toISOString()
    }
  }

  private async stopServer(): Promise<void> {
    const service = this.publishedService
    const bonjour = this.bonjour
    const server = this.server

    this.publishedService = null
    this.bonjour = null
    this.server = null
    this.app = null
    this.runningPort = null

    await new Promise<void>((resolve) => {
      if (!service) {
        resolve()
        return
      }
      service.stop(resolve)
    })

    bonjour?.destroy()

    await new Promise<void>((resolve) => {
      if (!server) {
        resolve()
        return
      }
      server.close(() => resolve())
    })
  }
}

export const dataSharingService = new DataSharingService()
