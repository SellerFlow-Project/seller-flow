import { HTTP_HEADER, HTTP_RETRY_POLICY, HTTP_RETRY_STATUS } from '../config/http'
import { sleep } from './time'
import { generateUserAgent } from './user-agent'

interface FetchResponseOptions {
  errorPrefix?: string
  maxAttempts?: number
}

export class HttpStatusError extends Error {
  public constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'HttpStatusError'
  }
}

export function setUrlSearchParams(url: URL, params: Record<string, string>): void {
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value)
  }
}

/** 模块级缓存的 User-Agent，所有请求共享，仅在重试时才更换 */
let currentUserAgent: string = generateUserAgent()

export function getCurrentUserAgent(): string {
  return currentUserAgent
}

/** 切换到新的随机 User-Agent，返回新值 */
export function rotateUserAgent(): string {
  currentUserAgent = generateUserAgent()
  return currentUserAgent
}

function applyUserAgent(init: RequestInit, userAgent: string): RequestInit {
  const headers = new Headers(init.headers)
  headers.set(HTTP_HEADER.USER_AGENT, userAgent)
  return { ...init, headers }
}

function getRetryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('Retry-After')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * HTTP_RETRY_POLICY.RETRY_AFTER_SECONDS_TO_MS)
    }

    const retryDate = Date.parse(retryAfter)
    if (!Number.isNaN(retryDate)) {
      return Math.max(0, retryDate - Date.now())
    }
  }

  const exponentialDelay = HTTP_RETRY_POLICY.BASE_DELAY_MS * 2 ** (attempt - 1)
  const jitter = Math.floor(Math.random() * HTTP_RETRY_POLICY.JITTER_MS)
  return Math.min(HTTP_RETRY_POLICY.MAX_DELAY_MS, exponentialDelay + jitter)
}

export async function fetchResponse(
  input: string | URL,
  init?: RequestInit,
  options: FetchResponseOptions = {}
): Promise<Response> {
  const baseInit: RequestInit = { ...init }
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts || HTTP_RETRY_POLICY.MAX_ATTEMPTS))

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const requestInit = applyUserAgent(baseInit, currentUserAgent)
    const response = await fetch(input, requestInit)
    if (response.ok) return response

    const shouldRetry = HTTP_RETRY_STATUS.has(response.status) && attempt < maxAttempts
    if (shouldRetry) {
      await sleep(getRetryDelayMs(response, attempt), init?.signal || undefined)
      // 重试前切换 User-Agent，后续所有请求都沿用新的 UA
      currentUserAgent = generateUserAgent()
      continue
    }

    const prefix = options.errorPrefix || 'HTTP 异常'
    throw new HttpStatusError(`${prefix}，状态码: ${response.status}`, response.status)
  }

  throw new Error('HTTP 重试流程异常结束')
}

export async function fetchJson<TResponse>(
  input: string | URL,
  init?: RequestInit,
  options?: FetchResponseOptions
): Promise<TResponse> {
  const response = await fetchResponse(input, init, options)
  return (await response.json()) as TResponse
}

export async function fetchText(
  input: string | URL,
  init?: RequestInit,
  options?: FetchResponseOptions
): Promise<string> {
  const response = await fetchResponse(input, init, options)
  return await response.text()
}
