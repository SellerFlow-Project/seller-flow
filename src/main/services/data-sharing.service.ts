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
  type DataSharingSearchKeywordQueryFilter,
  type DataSharingStatus,
  type SharedDataSource
} from '../../shared/data-sharing'
import type { DataSharingSettings } from '../../shared/settings'
import { databaseService } from './database.service'

const DISCOVERY_TIMEOUT_MS = 6000
const HEALTH_CHECK_TIMEOUT_MS = 2500
const REMOTE_REQUEST_TIMEOUT_MS = 8000
const LOCALHOST = '127.0.0.1'
const VIRTUAL_INTERFACE_KEYWORDS = [
  'utun',
  'tun',
  'tap',
  'vmnet',
  'vbox',
  'virtualbox',
  'docker',
  'veth',
  'bridge',
  'vEthernet',
  'hyper-v',
  'tailscale',
  'zerotier',
  'clash',
  'mihomo',
  'wireguard',
  'hamachi',
  'radmin'
].map((keyword) => keyword.toLowerCase())

type BonjourService = InstanceType<typeof Bonjour.Service>
type BonjourBrowser = InstanceType<typeof Bonjour.Browser>

interface LocalIPv4Address {
  address: string
  interfaceName: string
  priority: number
  isVirtual: boolean
}

interface HealthResponse {
  success: boolean
  app?: string
  protocolVersion?: string
  deviceId?: string
  displayName?: string
}

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

function isIPv4Address(value: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value)
}

function isPrivateIPv4Address(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part))
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false
  }

  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  )
}

function getIPv4Priority(address: string): number {
  const [first, second] = address.split('.').map((part) => Number(part))
  if (first === 192 && second === 168) return 0
  if (first === 10) return 1
  if (first === 172 && second >= 16 && second <= 31) return 2
  if (first === 169 && second === 254) return 8
  return 6
}

function isVirtualInterfaceName(name: string): boolean {
  const normalizedName = name.toLowerCase()
  return VIRTUAL_INTERFACE_KEYWORDS.some((keyword) => normalizedName.includes(keyword))
}

function getLocalIPv4Addresses(): LocalIPv4Address[] {
  const interfaces = networkInterfaces()
  const addresses: LocalIPv4Address[] = []

  for (const [interfaceName, entries] of Object.entries(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push({
          address: entry.address,
          interfaceName,
          priority: getIPv4Priority(entry.address),
          isVirtual: isVirtualInterfaceName(interfaceName)
        })
      }
    }
  }

  const privatePhysicalAddresses = addresses.filter(
    (item) => isPrivateIPv4Address(item.address) && !item.isVirtual
  )
  const candidates = privatePhysicalAddresses.length > 0 ? privatePhysicalAddresses : addresses

  return candidates.sort((left, right) => {
    if (left.isVirtual !== right.isVirtual) return left.isVirtual ? 1 : -1
    if (left.priority !== right.priority) return left.priority - right.priority
    return left.interfaceName.localeCompare(right.interfaceName)
  })
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
  private cachedSources = new Map<string, SharedDataSource>()
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
    const hosts = getLocalIPv4Addresses().map((item) => item.address)
    const primaryHost = hosts[0] || LOCALHOST

    return {
      enabled: settings.serverEnabled,
      running: Boolean(this.server && this.runningPort),
      port: this.runningPort,
      baseUrl: this.runningPort ? createBaseUrl(primaryHost, this.runningPort) : null,
      baseUrls: this.runningPort
        ? hosts.map((host) => createBaseUrl(host, this.runningPort as number))
        : [],
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
    const pendingHealthChecks: Promise<void>[] = []
    let browser: BonjourBrowser | null = null

    try {
      for (const cachedSource of this.cachedSources.values()) {
        pendingHealthChecks.push(
          this.createDataSourceFromHost(cachedSource.host, cachedSource.port, 'cache').then(
            (source) => {
              if (source) {
                sources.set(source.id, source)
                this.cachedSources.set(source.id, source)
              } else {
                this.cachedSources.delete(cachedSource.id)
              }
            }
          )
        )
      }

      browser = bonjour.find({ type: DATA_SHARING_SERVICE_TYPE }, (service) => {
        pendingHealthChecks.push(
          this.createDataSourceFromBonjourService(service, settings.deviceId).then((source) => {
            if (source) {
              sources.set(source.id, source)
              this.cachedSources.set(source.id, source)
            }
          })
        )
      })

      await new Promise<void>((resolve) => {
        setTimeout(resolve, DISCOVERY_TIMEOUT_MS)
        browser?.update()
      })

      for (const service of browser.services) {
        const source = await this.createDataSourceFromBonjourService(service, settings.deviceId)
        if (source) {
          sources.set(source.id, source)
          this.cachedSources.set(source.id, source)
        }
      }

      await Promise.allSettled(pendingHealthChecks)
    } finally {
      browser?.stop()
      bonjour.destroy()
    }

    return Array.from(sources.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  public async connectManualSource(host: string, port: number): Promise<SharedDataSource> {
    const source = await this.createDataSourceFromHost(host.trim(), Math.floor(port), 'manual')
    if (!source) {
      throw new Error('无法连接到该数据源，请确认 IP、端口和数据共享服务状态。')
    }

    this.cachedSources.set(source.id, source)
    return source
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

  public async queryRemoteSearchKeywords(
    source: SharedDataSource,
    filter: DataSharingSearchKeywordQueryFilter
  ): Promise<{ total: number; list: unknown[] }> {
    const response = await fetchJson<{
      success: boolean
      total?: number
      list?: unknown[]
      error?: string
    }>(`${normalizeRemoteBaseUrl(source)}/search-keywords/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(filter)
    })

    if (!response.success) {
      throw new Error(response.error || '远端搜索词数据读取失败。')
    }

    return {
      total: response.total || 0,
      list: response.list || []
    }
  }

  public async getRemoteSearchKeywordProducts(
    source: SharedDataSource,
    keywordId: number
  ): Promise<unknown[]> {
    const response = await fetchJson<{ success: boolean; list?: unknown[]; error?: string }>(
      `${normalizeRemoteBaseUrl(source)}/search-keywords/${keywordId}/products`
    )

    if (!response.success) {
      throw new Error(response.error || '远端搜索词商品列表读取失败。')
    }

    return response.list || []
  }

  public async markRemoteSearchKeywordAsRead(
    source: SharedDataSource,
    keywordId: number
  ): Promise<boolean> {
    const response = await fetchJson<{ success: boolean; updated?: boolean; error?: string }>(
      `${normalizeRemoteBaseUrl(source)}/search-keywords/${keywordId}/read`,
      {
        method: 'PATCH'
      }
    )

    if (!response.success) {
      throw new Error(response.error || '远端搜索词已读状态更新失败。')
    }

    return Boolean(response.updated)
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

    api.post(`${DATA_SHARING_API_PREFIX}/search-keywords/query`, (req: Request, res: Response) => {
      try {
        res.json({
          success: true,
          ...databaseService.queryAmazonSearchKeywords(
            req.body as DataSharingSearchKeywordQueryFilter
          )
        })
      } catch (error) {
        sendJsonError(res, error)
      }
    })

    api.get(`${DATA_SHARING_API_PREFIX}/search-keywords/:keywordId/products`, (req, res) => {
      try {
        res.json({
          success: true,
          list: databaseService.queryAmazonSearchKeywordProducts(toNumber(req.params.keywordId, 0))
        })
      } catch (error) {
        sendJsonError(res, error)
      }
    })

    api.patch(`${DATA_SHARING_API_PREFIX}/search-keywords/:keywordId/read`, (req, res) => {
      try {
        res.json({
          success: true,
          updated: databaseService.markAmazonSearchKeywordAsRead(toNumber(req.params.keywordId, 0))
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

    const localAddresses = getLocalIPv4Addresses().map((item) => item.address)
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
        displayName: settings.displayName,
        addresses: localAddresses.join(',')
      }
    })
  }

  private async createDataSourceFromBonjourService(
    service: BonjourService,
    localDeviceId: string
  ): Promise<SharedDataSource | null> {
    const txt = service.txt || {}
    const deviceId = typeof txt.deviceId === 'string' ? txt.deviceId : ''

    if (txt.app !== 'seller-flow' || !deviceId || deviceId === localDeviceId) {
      return null
    }

    if (!service.port) {
      return null
    }

    const candidateHosts = this.getBonjourCandidateHosts(service)
    for (const host of candidateHosts) {
      const source = await this.createDataSourceFromHost(host, service.port, 'mdns')
      if (source) {
        return {
          ...source,
          hostname: service.host
        }
      }
    }

    return null
  }

  private getBonjourCandidateHosts(service: BonjourService): string[] {
    const txt = service.txt || {}
    const txtAddresses =
      typeof txt.addresses === 'string'
        ? txt.addresses
            .split(',')
            .map((address) => address.trim())
            .filter(Boolean)
        : []
    const rawHosts = [
      ...txtAddresses,
      ...(service.addresses || []),
      service.referer?.address,
      service.host
    ].filter((host): host is string => Boolean(host && isIPv4Address(host)))
    const uniqueHosts = Array.from(new Set(rawHosts))

    return uniqueHosts.sort((left, right) => getIPv4Priority(left) - getIPv4Priority(right))
  }

  private async createDataSourceFromHost(
    host: string,
    port: number,
    sourceType: NonNullable<SharedDataSource['sourceType']>
  ): Promise<SharedDataSource | null> {
    if (!isIPv4Address(host) || !port || port < 1 || port > 65535) {
      return null
    }

    try {
      const baseUrl = createBaseUrl(host, port)
      const health = await this.fetchHealth(baseUrl)
      if (
        !health.success ||
        health.app !== 'seller-flow' ||
        health.protocolVersion !== DATA_SHARING_PROTOCOL_VERSION ||
        !health.deviceId
      ) {
        return null
      }

      const source: SharedDataSource = {
        id: health.deviceId,
        name: health.displayName || `SellerFlow 数据服务 (${host})`,
        host,
        port,
        baseUrl,
        deviceId: health.deviceId,
        sourceType,
        lastSeenAt: new Date().toISOString()
      }
      return source
    } catch {
      return null
    }
  }

  private async fetchHealth(baseUrl: string): Promise<HealthResponse> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)

    try {
      const response = await fetch(`${baseUrl}/health`, {
        signal: controller.signal
      })
      if (!response.ok) {
        throw new Error(`health check failed: ${response.status}`)
      }
      return (await response.json()) as HealthResponse
    } finally {
      clearTimeout(timer)
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
