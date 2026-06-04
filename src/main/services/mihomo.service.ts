import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { existsSync } from 'fs'
import { chmod, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import yaml from 'js-yaml'
import { ProxyAgent } from 'undici'
import type { Dispatcher } from 'undici'
import type { CrawlingSettings } from '../../shared/settings'
import type { MihomoProxyNode, MihomoRuntimeStatus } from '../../shared/mihomo'
import { getErrorMessage } from '../utils/error'
import { sleep } from '../utils/time'
import { getCrawlingSettings } from './settings.service'

interface ClashSubscriptionConfig {
  proxies?: unknown[]
}

type NodeSelectionStrategy = CrawlingSettings['proxyNodeStrategy']
type MihomoProxyConfig = Record<string, unknown>
type MihomoRequestScope = 'general' | 'category' | 'detail'

type ScopedMihomoProxyNode = MihomoProxyNode & {
  scopeCooldownUntil: Partial<Record<MihomoRequestScope, string>>
}

const MIHOMO_RUNTIME_DIR_NAME = 'mihomo-runtime'
const MIHOMO_CONFIG_FILE_NAME = 'config.yaml'
const MIHOMO_CONTROLLER_HOST = '127.0.0.1'
const NODE_COOLDOWN_MS = 10 * 60 * 1000
const NODE_POOL_WAIT_POLL_MS = 1000
const NODE_POOL_MAX_WAIT_SLICE_MS = 60_000
const DEFAULT_TEST_TIMEOUT_MS = 8000
const CORE_START_TIMEOUT_MS = 6000
const CORE_START_POLL_INTERVAL_MS = 250

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function tryDecodeBase64(value: string): string | null {
  const compactValue = value.trim().replace(/\s+/g, '')
  if (!compactValue || !/^[A-Za-z0-9+/_=-]+$/.test(compactValue)) {
    return null
  }

  try {
    const normalizedValue = compactValue.replace(/-/g, '+').replace(/_/g, '/')
    const paddedValue = normalizedValue.padEnd(
      normalizedValue.length + ((4 - (normalizedValue.length % 4)) % 4),
      '='
    )
    const decoded = Buffer.from(paddedValue, 'base64').toString('utf-8').trim()
    if (!decoded || decoded.includes('\u0000')) return null
    return decoded
  } catch {
    return null
  }
}

function parseYamlSubscription(text: string): ClashSubscriptionConfig | null {
  try {
    const parsed = yaml.load(text)
    if (!isRecord(parsed) || !Array.isArray(parsed.proxies)) {
      return null
    }

    return parsed as ClashSubscriptionConfig
  } catch {
    return null
  }
}

function isSupportedShareLink(line: string): boolean {
  return /^(vless|vmess|trojan|ss):\/\//i.test(line.trim())
}

function isSubscriptionMetadataNodeName(name: string): boolean {
  return [
    '剩余流量',
    '距离下次',
    '套餐到期',
    '到期时间',
    '过期时间',
    'traffic',
    'expire',
    'reset'
  ].some((keyword) => name.toLowerCase().includes(keyword.toLowerCase()))
}

function getSubscriptionTextCandidates(text: string): string[] {
  const candidates = [text.trim()].filter(Boolean)
  const decodedText = tryDecodeBase64(text)

  if (decodedText && decodedText !== text.trim()) {
    candidates.push(decodedText)
  }

  return candidates
}

function getShareLinkName(url: URL, fallbackName: string): string {
  const hashName = safeDecodeURIComponent(url.hash.replace(/^#/, '')).trim()
  return hashName || fallbackName
}

function getShareLinkServerPort(url: URL): { server: string; port: number } | null {
  const port = Number(url.port)
  if (!url.hostname || !Number.isInteger(port) || port <= 0 || port > 65535) {
    return null
  }

  return {
    server: url.hostname,
    port
  }
}

function getFirstQueryValue(query: URLSearchParams, names: string[]): string {
  for (const name of names) {
    const value = query.get(name)
    if (value) return value
  }

  return ''
}

function getQueryBoolean(query: URLSearchParams, name: string): boolean {
  const value = query.get(name)
  return value === '1' || value === 'true'
}

function applyTlsOptions(
  node: MihomoProxyConfig,
  query: URLSearchParams,
  options: { protocol: 'vless' | 'vmess' | 'trojan'; vmessTlsValue?: string } = {
    protocol: 'vless'
  }
): void {
  const security = query.get('security')
  const tlsEnabled =
    security === 'tls' ||
    security === 'reality' ||
    options.vmessTlsValue === 'tls' ||
    options.vmessTlsValue === '1'

  if (!tlsEnabled) return

  node.tls = true

  const sni = getFirstQueryValue(query, ['sni', 'servername', 'peer'])
  if (sni) {
    if (options.protocol === 'trojan') {
      node.sni = sni
    } else {
      node.servername = sni
    }
  }

  const fingerprint = getFirstQueryValue(query, ['fp', 'fingerprint'])
  if (fingerprint) node['client-fingerprint'] = fingerprint

  if (getQueryBoolean(query, 'insecure') || getQueryBoolean(query, 'allowInsecure')) {
    node['skip-cert-verify'] = true
  }

  if (security === 'reality') {
    const publicKey = query.get('pbk')
    const shortId = query.get('sid')
    if (publicKey || shortId) {
      node['reality-opts'] = {
        ...(publicKey ? { 'public-key': publicKey } : {}),
        ...(shortId ? { 'short-id': shortId } : {})
      }
    }
  }
}

function applyTransportOptions(
  node: MihomoProxyConfig,
  network: string,
  query: URLSearchParams
): void {
  const normalizedNetwork = network.trim()
  if (!normalizedNetwork || normalizedNetwork === 'tcp') return

  node.network = normalizedNetwork

  const host = getFirstQueryValue(query, ['host', 'obfs-host'])
  const path = safeDecodeURIComponent(getFirstQueryValue(query, ['path', 'obfs-uri']))

  if (normalizedNetwork === 'ws') {
    node['ws-opts'] = {
      ...(path ? { path } : {}),
      ...(host ? { headers: { Host: host } } : {})
    }
    return
  }

  if (normalizedNetwork === 'grpc') {
    const serviceName = query.get('serviceName')
    if (serviceName) {
      node['grpc-opts'] = { 'grpc-service-name': serviceName }
    }
    return
  }

  if (normalizedNetwork === 'h2') {
    node['h2-opts'] = {
      ...(path ? { path } : {}),
      ...(host ? { host: [host] } : {})
    }
  }
}

function parseVlessShareLink(line: string, index: number): MihomoProxyConfig | null {
  const url = new URL(line)
  const serverPort = getShareLinkServerPort(url)
  const uuid = safeDecodeURIComponent(url.username)
  if (!serverPort || !uuid) return null

  const name = getShareLinkName(url, `vless-${index + 1}`)
  if (isSubscriptionMetadataNodeName(name)) return null

  const query = url.searchParams
  const node: MihomoProxyConfig = {
    name,
    type: 'vless',
    server: serverPort.server,
    port: serverPort.port,
    uuid,
    udp: true
  }

  const flow = query.get('flow')
  if (flow) node.flow = flow

  applyTlsOptions(node, query, { protocol: 'vless' })
  applyTransportOptions(node, getFirstQueryValue(query, ['type', 'network']), query)
  return node
}

function parseTrojanShareLink(line: string, index: number): MihomoProxyConfig | null {
  const url = new URL(line)
  const serverPort = getShareLinkServerPort(url)
  const password = safeDecodeURIComponent(url.username)
  if (!serverPort || !password) return null

  const name = getShareLinkName(url, `trojan-${index + 1}`)
  if (isSubscriptionMetadataNodeName(name)) return null

  const query = url.searchParams
  const node: MihomoProxyConfig = {
    name,
    type: 'trojan',
    server: serverPort.server,
    port: serverPort.port,
    password,
    udp: true
  }

  applyTlsOptions(node, query, { protocol: 'trojan' })
  applyTransportOptions(node, getFirstQueryValue(query, ['type', 'network']), query)
  return node
}

function parseVmessShareLink(line: string, index: number): MihomoProxyConfig | null {
  const encodedConfig = line.replace(/^vmess:\/\//i, '')
  const decodedConfig = tryDecodeBase64(encodedConfig)
  if (!decodedConfig) return null

  const config = JSON.parse(decodedConfig) as Record<string, unknown>
  const server = typeof config.add === 'string' ? config.add : ''
  const uuid = typeof config.id === 'string' ? config.id : ''
  const port = Number(config.port)
  if (!server || !uuid || !Number.isInteger(port) || port <= 0 || port > 65535) return null

  const name =
    typeof config.ps === 'string' && config.ps.trim() ? config.ps.trim() : `vmess-${index + 1}`
  if (isSubscriptionMetadataNodeName(name)) return null

  const query = new URLSearchParams()
  const host = typeof config.host === 'string' ? config.host : ''
  const path = typeof config.path === 'string' ? config.path : ''
  const sni = typeof config.sni === 'string' ? config.sni : ''
  const fingerprint = typeof config.fp === 'string' ? config.fp : ''
  if (host) query.set('host', host)
  if (path) query.set('path', path)
  if (sni) query.set('sni', sni)
  if (fingerprint) query.set('fp', fingerprint)

  const network = typeof config.net === 'string' ? config.net : ''
  const node: MihomoProxyConfig = {
    name,
    type: 'vmess',
    server,
    port,
    uuid,
    alterId: Number(config.aid) || 0,
    cipher: typeof config.scy === 'string' && config.scy ? config.scy : 'auto',
    udp: true
  }

  applyTlsOptions(node, query, {
    protocol: 'vmess',
    vmessTlsValue: typeof config.tls === 'string' ? config.tls : ''
  })
  applyTransportOptions(node, network, query)
  return node
}

function parseSsServerPort(hostPart: string): { server: string; port: number } | null {
  try {
    const url = new URL(`http://${hostPart}`)
    return getShareLinkServerPort(url)
  } catch {
    return null
  }
}

function parseSsShareLink(line: string, index: number): MihomoProxyConfig | null {
  const withoutProtocol = line.replace(/^ss:\/\//i, '')
  const [linkBody, rawName = ''] = withoutProtocol.split('#')
  const name = safeDecodeURIComponent(rawName).trim() || `ss-${index + 1}`
  if (isSubscriptionMetadataNodeName(name)) return null

  const bodyWithoutQuery = linkBody.split('?')[0]
  let method = ''
  let password = ''
  let serverPort: { server: string; port: number } | null = null

  if (bodyWithoutQuery.includes('@')) {
    const atIndex = bodyWithoutQuery.lastIndexOf('@')
    const userInfo = bodyWithoutQuery.slice(0, atIndex)
    const hostPart = bodyWithoutQuery.slice(atIndex + 1)
    const decodedUserInfo = userInfo.includes(':') ? userInfo : tryDecodeBase64(userInfo)
    if (!decodedUserInfo) return null

    const colonIndex = decodedUserInfo.indexOf(':')
    if (colonIndex <= 0) return null

    method = safeDecodeURIComponent(decodedUserInfo.slice(0, colonIndex))
    password = safeDecodeURIComponent(decodedUserInfo.slice(colonIndex + 1))
    serverPort = parseSsServerPort(hostPart)
  } else {
    const decodedBody = tryDecodeBase64(bodyWithoutQuery)
    if (!decodedBody) return null

    const atIndex = decodedBody.lastIndexOf('@')
    const colonIndex = decodedBody.indexOf(':')
    if (colonIndex <= 0 || atIndex <= colonIndex) return null

    method = decodedBody.slice(0, colonIndex)
    password = decodedBody.slice(colonIndex + 1, atIndex)
    serverPort = parseSsServerPort(decodedBody.slice(atIndex + 1))
  }

  if (!method || !password || !serverPort) return null

  return {
    name,
    type: 'ss',
    server: serverPort.server,
    port: serverPort.port,
    cipher: method,
    password,
    udp: true
  }
}

function parseShareLink(line: string, index: number): MihomoProxyConfig | null {
  try {
    if (/^vless:\/\//i.test(line)) return parseVlessShareLink(line, index)
    if (/^vmess:\/\//i.test(line)) return parseVmessShareLink(line, index)
    if (/^trojan:\/\//i.test(line)) return parseTrojanShareLink(line, index)
    if (/^ss:\/\//i.test(line)) return parseSsShareLink(line, index)
  } catch {
    return null
  }

  return null
}

function parseShareLinkSubscription(text: string): ClashSubscriptionConfig | null {
  const proxies = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(isSupportedShareLink)
    .map(parseShareLink)
    .filter((node): node is MihomoProxyConfig => Boolean(node))

  return proxies.length > 0 ? { proxies } : null
}

function sanitizeNodeId(name: string, index: number): string {
  const normalized = name
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || `node-${index + 1}`
}

function getDefaultMihomoBinaryPath(): string {
  const executableName = process.platform === 'win32' ? 'mihomo.exe' : 'mihomo'
  const platformArch = `${process.platform}-${process.arch}`

  if (app.isPackaged) {
    return join(process.resourcesPath, 'mihomo', platformArch, executableName)
  }

  return join(app.getAppPath(), 'resources', 'mihomo', platformArch, executableName)
}

async function ensureMihomoBinaryExecutable(binaryPath: string): Promise<void> {
  if (process.platform === 'win32') return

  try {
    await chmod(binaryPath, 0o755)
  } catch (error) {
    throw new Error(`Mihomo Core 缺少执行权限，且自动修复失败：${getErrorMessage(error)}`)
  }
}

function getMihomoSpawnErrorMessage(binaryPath: string, error: Error): string {
  const code = (error as NodeJS.ErrnoException).code

  if (code === 'EACCES') {
    return `Mihomo Core 没有执行权限：${binaryPath}`
  }

  if (code === 'ENOENT') {
    return `未找到 Mihomo Core：${binaryPath}`
  }

  return `Mihomo Core 启动失败：${getErrorMessage(error)}`
}

function normalizeSubscriptionNode(rawNode: unknown, index: number): Record<string, unknown> | null {
  if (!isRecord(rawNode) || typeof rawNode.name !== 'string' || typeof rawNode.type !== 'string') {
    return null
  }

  return { ...rawNode, name: rawNode.name.trim() || `node-${index + 1}` }
}

function ensureUniqueNodeNames(nodes: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const seen = new Map<string, number>()

  return nodes.map((node) => {
    const originalName = String(node.name)
    const count = seen.get(originalName) || 0
    seen.set(originalName, count + 1)

    return count === 0
      ? node
      : {
          ...node,
          name: `${originalName} #${count + 1}`
        }
  })
}

function createRuntimeConfig(
  nodes: Array<Record<string, unknown>>,
  settings: CrawlingSettings
): string {
  const listeners = nodes.map((node, index) => ({
    name: `sellerflow-${sanitizeNodeId(String(node.name), index)}`,
    type: 'mixed',
    listen: MIHOMO_CONTROLLER_HOST,
    port: settings.mihomoMixedPortStart + index,
    proxy: node.name,
    users: []
  }))

  return yaml.dump(
    {
      'allow-lan': false,
      'bind-address': MIHOMO_CONTROLLER_HOST,
      mode: 'rule',
      'log-level': 'warning',
      ipv6: false,
      'external-controller': `${MIHOMO_CONTROLLER_HOST}:${settings.mihomoControllerPort}`,
      secret: '',
      proxies: nodes,
      listeners,
      rules: ['MATCH,DIRECT']
    },
    { lineWidth: 160, noRefs: true }
  )
}

class MihomoService {
  private process: ChildProcessWithoutNullStreams | null = null
  private nodes: ScopedMihomoProxyNode[] = []
  private agents = new Map<string, ProxyAgent>()
  private settings: CrawlingSettings | null = null
  private controllerUrl = ''
  private lastError = ''
  private roundRobinIndex = 0

  public async applySettings(settings: CrawlingSettings): Promise<MihomoRuntimeStatus> {
    this.settings = settings
    this.controllerUrl = `http://${MIHOMO_CONTROLLER_HOST}:${settings.mihomoControllerPort}`

    if (!settings.mihomoEnabled || settings.proxyMode !== 'mihomo-node-pool') {
      await this.stop()
      return this.getStatus()
    }

    await this.refreshSubscription(settings)
    return this.getStatus()
  }

  public async shutdown(): Promise<void> {
    await this.stop()
  }

  public getStatus(): MihomoRuntimeStatus {
    const settings = this.settings || getCrawlingSettings()
    return {
      enabled: settings.mihomoEnabled && settings.proxyMode === 'mihomo-node-pool',
      running: Boolean(this.process && !this.process.killed),
      mode: settings.proxyMode === 'mihomo-node-pool' ? 'node-pool' : 'disabled',
      controllerUrl: this.controllerUrl || `http://${MIHOMO_CONTROLLER_HOST}:${settings.mihomoControllerPort}`,
      nodeCount: this.nodes.length,
      activeNodeId: this.nodes.find((node) => node.alive)?.id || null,
      error: this.lastError || undefined
    }
  }

  public listNodes(): MihomoProxyNode[] {
    return this.nodes.map((node) => ({ ...node }))
  }

  public async refreshSubscription(
    settings: CrawlingSettings = getCrawlingSettings()
  ): Promise<MihomoRuntimeStatus> {
    this.settings = settings
    this.controllerUrl = `http://${MIHOMO_CONTROLLER_HOST}:${settings.mihomoControllerPort}`
    this.lastError = ''

    if (!settings.mihomoSubscriptionUrl.trim()) {
      await this.stop()
      this.lastError = '尚未配置 Clash/Mihomo 订阅链接。'
      return this.getStatus()
    }

    const binaryPath = settings.mihomoBinaryPath.trim() || getDefaultMihomoBinaryPath()
    if (!existsSync(binaryPath)) {
      await this.stop()
      this.lastError = `未找到 Mihomo Core: ${binaryPath}`
      return this.getStatus()
    }

    try {
      const subscription = await this.fetchSubscription(settings.mihomoSubscriptionUrl)
      const rawNodes = subscription.proxies || []
      const normalizedNodes = rawNodes
        .map(normalizeSubscriptionNode)
        .filter((node): node is Record<string, unknown> => Boolean(node))
      const selectedNodes =
        settings.mihomoMaxNodeCount > 0
          ? normalizedNodes.slice(0, settings.mihomoMaxNodeCount)
          : normalizedNodes
      const nodes = ensureUniqueNodeNames(
        selectedNodes
      )

      if (nodes.length === 0) {
        throw new Error('订阅中没有解析到可用节点。')
      }

      const runtimeDir = join(app.getPath('userData'), MIHOMO_RUNTIME_DIR_NAME)
      await mkdir(runtimeDir, { recursive: true })
      await writeFile(
        join(runtimeDir, MIHOMO_CONFIG_FILE_NAME),
        createRuntimeConfig(nodes, settings),
        'utf-8'
      )

      await this.restartCore(binaryPath, runtimeDir, settings)
      this.nodes = nodes.map((node, index) => ({
        id: sanitizeNodeId(String(node.name), index),
        name: String(node.name),
        type: String(node.type),
        localPort: settings.mihomoMixedPortStart + index,
        alive: true,
        latency: null,
        failCount: 0,
        cooldownUntil: null,
        categoryCooldownUntil: null,
        detailCooldownUntil: null,
        scopeCooldownUntil: {}
      }))
      this.agents.clear()
    } catch (error) {
      this.lastError = getErrorMessage(error)
      await this.stop()
    }

    return this.getStatus()
  }

  public async testNode(nodeId: string): Promise<MihomoProxyNode> {
    const node = this.findNode(nodeId)
    const start = Date.now()
    const agent = this.getAgentForNode(node)

    try {
      const response = await fetch(this.getSettings().mihomoHealthCheckUrl, {
        dispatcher: agent,
        signal: AbortSignal.timeout(DEFAULT_TEST_TIMEOUT_MS)
      } as RequestInit & { dispatcher: Dispatcher })
      node.latency = Date.now() - start
      node.alive = response.ok
      node.lastError = response.ok ? undefined : `HTTP ${response.status}`
      if (response.ok) {
        node.cooldownUntil = null
        node.categoryCooldownUntil = null
        node.detailCooldownUntil = null
        node.scopeCooldownUntil = {}
      }
      return { ...node }
    } catch (error) {
      node.alive = false
      node.lastError = getErrorMessage(error)
      node.failCount++
      node.cooldownUntil = new Date(Date.now() + NODE_COOLDOWN_MS).toISOString()
      return { ...node }
    }
  }

  public async getFetchDispatcher(
    scope: MihomoRequestScope = 'general',
    signal?: AbortSignal
  ): Promise<Dispatcher | undefined> {
    const settings = this.getSettings()
    if (!settings.mihomoEnabled || settings.proxyMode !== 'mihomo-node-pool') return undefined
    if (this.nodes.length === 0) {
      throw new Error('Mihomo 节点池未就绪，暂无可用节点。')
    }

    while (true) {
      const node = this.pickNode(settings.proxyNodeStrategy, scope)
      if (node) return this.getAgentForNode(node)

      const waitMilliseconds = this.getNextNodeAvailabilityDelay(scope)
      await sleep(waitMilliseconds, signal)
    }
  }

  public markNodeFailure(
    dispatcher: Dispatcher | undefined,
    error: unknown,
    scope: MihomoRequestScope = 'general'
  ): void {
    if (!dispatcher) return

    const node = this.nodes.find((item) => this.agents.get(item.id) === dispatcher)
    if (!node) return

    const cooldownUntil = new Date(Date.now() + NODE_COOLDOWN_MS).toISOString()
    node.failCount++
    node.lastError = getErrorMessage(error)

    if (scope === 'general') {
      node.cooldownUntil = cooldownUntil
      node.alive = false
      return
    }

    node.scopeCooldownUntil[scope] = cooldownUntil
    if (scope === 'category') node.categoryCooldownUntil = cooldownUntil
    if (scope === 'detail') node.detailCooldownUntil = cooldownUntil
  }


  private async fetchSubscription(subscriptionUrl: string): Promise<ClashSubscriptionConfig> {
    const response = await fetch(subscriptionUrl)
    if (!response.ok) {
      throw new Error(`订阅下载失败，HTTP ${response.status}`)
    }

    const text = await response.text()
    for (const candidate of getSubscriptionTextCandidates(text)) {
      const yamlSubscription = parseYamlSubscription(candidate)
      if (yamlSubscription) {
        return yamlSubscription
      }

      const shareLinkSubscription = parseShareLinkSubscription(candidate)
      if (shareLinkSubscription) {
        return shareLinkSubscription
      }
    }

    throw new Error(
      '订阅内容既不是有效的 Clash/Mihomo YAML，也没有解析到支持的分享链接节点。当前支持 vless、vmess、trojan、ss。'
    )
  }

  private async restartCore(
    binaryPath: string,
    runtimeDir: string,
    settings: CrawlingSettings
  ): Promise<void> {
    await this.stop()
    await ensureMihomoBinaryExecutable(binaryPath)

    const childProcess = spawn(binaryPath, ['-d', runtimeDir], {
      cwd: runtimeDir,
      windowsHide: true
    })
    this.process = childProcess

    childProcess.stderr.on('data', (chunk) => {
      const message = String(chunk).trim()
      if (message) this.lastError = message
    })
    childProcess.on('exit', (_code, signal) => {
      if (this.process === childProcess) this.process = null
      if (signal !== 'SIGTERM' && signal !== 'SIGKILL') {
        this.lastError = this.lastError || 'Mihomo Core 已退出。'
      }
    })

    await new Promise<void>((resolve, reject) => {
      const handleSpawnError = (error: Error): void => {
        const message = getMihomoSpawnErrorMessage(binaryPath, error)
        this.lastError = message
        if (this.process === childProcess) this.process = null
        reject(new Error(message))
      }

      childProcess.once('error', handleSpawnError)
      this.waitForControllerReady(settings).then(
        () => {
          childProcess.off('error', handleSpawnError)
          resolve()
        },
        (error) => {
          childProcess.off('error', handleSpawnError)
          reject(error)
        }
      )
    })
  }

  private async waitForControllerReady(settings: CrawlingSettings): Promise<void> {
    const deadline = Date.now() + CORE_START_TIMEOUT_MS
    const controllerUrl = `http://${MIHOMO_CONTROLLER_HOST}:${settings.mihomoControllerPort}`
    let lastError = ''

    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${controllerUrl}/version`)
        if (response.ok) return
        lastError = `HTTP ${response.status}`
      } catch (error) {
        lastError = getErrorMessage(error)
      }

      await new Promise((resolve) => setTimeout(resolve, CORE_START_POLL_INTERVAL_MS))
    }

    throw new Error(`Mihomo Core 启动超时，控制端未就绪: ${lastError || controllerUrl}`)
  }

  private async stop(): Promise<void> {
    this.agents.clear()
    this.nodes = []
    if (!this.process) return

    const currentProcess = this.process
    this.process = null
    currentProcess.kill()
  }

  private getSettings(): CrawlingSettings {
    return this.settings || getCrawlingSettings()
  }

  private findNode(nodeId: string): ScopedMihomoProxyNode {
    const node = this.nodes.find((item) => item.id === nodeId)
    if (!node) {
      throw new Error(`未找到代理节点: ${nodeId}`)
    }
    return node
  }

  private getAgentForNode(node: ScopedMihomoProxyNode): ProxyAgent {
    let agent = this.agents.get(node.id)
    if (!agent) {
      agent = new ProxyAgent(`http://127.0.0.1:${node.localPort}`)
      this.agents.set(node.id, agent)
    }
    return agent
  }

  private getNextNodeAvailabilityDelay(scope: MihomoRequestScope): number {
    const now = Date.now()
    const futureCooldowns = this.nodes
      .flatMap((node) => [
        node.cooldownUntil,
        scope === 'general' ? undefined : node.scopeCooldownUntil[scope]
      ])
      .map((cooldownUntil) => (cooldownUntil ? Date.parse(cooldownUntil) : Number.NaN))
      .filter((timestamp) => Number.isFinite(timestamp) && timestamp > now)

    if (futureCooldowns.length === 0) return NODE_POOL_WAIT_POLL_MS

    return Math.max(
      NODE_POOL_WAIT_POLL_MS,
      Math.min(Math.min(...futureCooldowns) - now, NODE_POOL_MAX_WAIT_SLICE_MS)
    )
  }

  private normalizeExpiredCooldowns(node: ScopedMihomoProxyNode, now: number): void {
    if (node.cooldownUntil && Date.parse(node.cooldownUntil) <= now) {
      node.cooldownUntil = null
      node.alive = true
    }

    for (const scope of ['category', 'detail'] as const) {
      const cooldownUntil = node.scopeCooldownUntil[scope]
      if (cooldownUntil && Date.parse(cooldownUntil) <= now) {
        delete node.scopeCooldownUntil[scope]
        if (scope === 'category') node.categoryCooldownUntil = null
        if (scope === 'detail') node.detailCooldownUntil = null
      }
    }
  }

  private isNodeAvailableForScope(node: ScopedMihomoProxyNode, scope: MihomoRequestScope): boolean {
    const now = Date.now()
    this.normalizeExpiredCooldowns(node, now)

    if (node.cooldownUntil && Date.parse(node.cooldownUntil) > now) return false
    if (!node.alive) return false
    if (scope === 'general') return true

    const scopedCooldownUntil = node.scopeCooldownUntil[scope]
    return !scopedCooldownUntil || Date.parse(scopedCooldownUntil) <= now
  }

  private pickNode(
    strategy: NodeSelectionStrategy,
    scope: MihomoRequestScope
  ): ScopedMihomoProxyNode | null {
    const availableNodes = this.nodes.filter((node) => this.isNodeAvailableForScope(node, scope))

    if (availableNodes.length === 0) return null

    if (strategy === 'random') {
      return availableNodes[Math.floor(Math.random() * availableNodes.length)]
    }

    if (strategy === 'lowest-latency') {
      return [...availableNodes].sort((left, right) => {
        const leftLatency = left.latency ?? Number.MAX_SAFE_INTEGER
        const rightLatency = right.latency ?? Number.MAX_SAFE_INTEGER
        return leftLatency - rightLatency
      })[0]
    }

    const node = availableNodes[this.roundRobinIndex % availableNodes.length]
    this.roundRobinIndex++
    return node
  }
}

export const mihomoService = new MihomoService()
