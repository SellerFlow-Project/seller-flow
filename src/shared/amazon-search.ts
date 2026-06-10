export type AmazonSearchMarketplace = 'JP' | 'US' | 'UK' | 'DE'
export type AmazonSearchRunState = 'idle' | 'running' | 'stopping'

export const AMAZON_SEARCH_TASK_TYPE = 'amazon_search_keywords' as const
export const AMAZON_SEARCH_TASK_TYPE_NAME = '亚马逊搜索词采集'

export interface Amz123Session {
  token: string
  username: string
  avatar?: string
  expire: number
  appUid?: number
  roleIdList: number[]
}

export interface Amz123LoginCode {
  ticket: string
  imageDataUrl: string
}

export interface Amz123LoginStatus {
  action: number
  message: string
  session?: Amz123Session
}

export interface AmazonSearchConfig {
  marketplace: AmazonSearchMarketplace
  selectedRanks: string[]
  selectedChanges: string[]
  minDeliveryInterval: number
  maxDeliveryInterval: number
  matchingProductCount: number
  concurrency: number
}

export interface AmazonSearchMetrics {
  totalKeywords: number
  processedKeywords: number
  savedKeywords: number
  totalCollected: number
  failedKeywords: number
  startedAt?: string
  completedAt?: string
}

export interface AmazonSearchStatus {
  isRunning: boolean
  isStopping: boolean
  runState: AmazonSearchRunState
  taskId: number | null
  config: AmazonSearchConfig | null
  metrics: AmazonSearchMetrics
}

export interface AmazonSearchLocalState {
  session: Amz123Session | null
  config: AmazonSearchConfig
  status: AmazonSearchStatus
}

export interface AmazonSearchStartResult {
  taskId: number
  runState: 'running'
}

export interface AmazonSearchStopResult {
  accepted: boolean
  taskId: number | null
  runState: AmazonSearchRunState
  databaseStatusUpdated: boolean
}

export interface AmazonSearchApi {
  getLocalState: () => Promise<AmazonSearchLocalState>
  saveConfig: (config: AmazonSearchConfig) => Promise<AmazonSearchConfig>
  requestLoginCode: () => Promise<Amz123LoginCode>
  pollLoginStatus: (ticket: string) => Promise<Amz123LoginStatus>
  logout: () => Promise<{ success: true }>
  startTask: (config: AmazonSearchConfig) => Promise<AmazonSearchStartResult>
  stopTask: () => Promise<AmazonSearchStopResult>
  getStatus: () => Promise<AmazonSearchStatus>
  onLog: (callback: (log: string) => void) => () => void
  onStateChange: (callback: (state: AmazonSearchStatus) => void) => () => void
}

const MARKETPLACES = new Set<AmazonSearchMarketplace>(['JP', 'US', 'UK', 'DE'])
const RUN_STATES = new Set<AmazonSearchRunState>(['idle', 'running', 'stopping'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isAmz123Session(value: unknown): value is Amz123Session {
  return (
    isRecord(value) &&
    typeof value.token === 'string' &&
    typeof value.username === 'string' &&
    isNumber(value.expire) &&
    Array.isArray(value.roleIdList)
  )
}

export function isAmz123LoginCode(value: unknown): value is Amz123LoginCode {
  return (
    isRecord(value) && typeof value.ticket === 'string' && typeof value.imageDataUrl === 'string'
  )
}

export function isAmz123LoginStatus(value: unknown): value is Amz123LoginStatus {
  return (
    isRecord(value) &&
    isNumber(value.action) &&
    typeof value.message === 'string' &&
    (value.session === undefined || isAmz123Session(value.session))
  )
}

export function isAmazonSearchConfig(value: unknown): value is AmazonSearchConfig {
  return (
    isRecord(value) &&
    MARKETPLACES.has(value.marketplace as AmazonSearchMarketplace) &&
    isStringArray(value.selectedRanks) &&
    isStringArray(value.selectedChanges) &&
    isNumber(value.minDeliveryInterval) &&
    isNumber(value.maxDeliveryInterval) &&
    isNumber(value.matchingProductCount) &&
    isNumber(value.concurrency)
  )
}

export function isAmazonSearchMetrics(value: unknown): value is AmazonSearchMetrics {
  return (
    isRecord(value) &&
    isNumber(value.totalKeywords) &&
    isNumber(value.processedKeywords) &&
    isNumber(value.savedKeywords) &&
    isNumber(value.totalCollected) &&
    isNumber(value.failedKeywords)
  )
}

export function isAmazonSearchStatus(value: unknown): value is AmazonSearchStatus {
  return (
    isRecord(value) &&
    typeof value.isRunning === 'boolean' &&
    typeof value.isStopping === 'boolean' &&
    RUN_STATES.has(value.runState as AmazonSearchRunState) &&
    (value.taskId === null || isNumber(value.taskId)) &&
    (value.config === null || isAmazonSearchConfig(value.config)) &&
    isAmazonSearchMetrics(value.metrics)
  )
}

export function isAmazonSearchLocalState(value: unknown): value is AmazonSearchLocalState {
  return (
    isRecord(value) &&
    (value.session === null || isAmz123Session(value.session)) &&
    isAmazonSearchConfig(value.config) &&
    isAmazonSearchStatus(value.status)
  )
}
