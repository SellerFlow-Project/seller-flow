import { app } from 'electron'
import Store from 'electron-store'
import { ACCOUNT_API_BASE_URL, ACCOUNT_API_DEFAULT_LIMIT } from '../config/account'
import {
  type AccountRole,
  type AccountSession,
  type AccountUser,
  type AuditLog,
  type CreateRegistrationCodeRequest,
  type CreatedRegistrationCode,
  type LoginRequest,
  type RegisterRequest,
  type RegistrationCode,
  type SessionCheckResult,
  isAccountSession,
  isAccountUser,
  isAuditLog
} from '../../shared/account'

interface AccountStore {
  session: AccountSession | null
}

interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    request_id?: string
  }
}

class AccountApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
  }
}

let store: Store<AccountStore> | undefined

function getStore(): Store<AccountStore> {
  store ??= new Store<AccountStore>({
    name: 'account-session',
    defaults: {
      session: null
    }
  })

  return store
}

function createUrl(path: string, params?: Record<string, string | number>): string {
  const baseUrl = ACCOUNT_API_BASE_URL.replace(/\/+$/, '')
  const url = new URL(`${baseUrl}${path}`)

  Object.entries(params || {}).forEach(([key, value]) => {
    url.searchParams.set(key, String(value))
  })

  return url.toString()
}

function isSessionExpired(session: AccountSession): boolean {
  const expiresAt = new Date(session.expires_at).getTime()
  return Number.isFinite(expiresAt) && expiresAt <= Date.now()
}

function normalizeRegistrationCode(
  value: RegistrationCode,
  plaintextCode?: string
): RegistrationCode {
  return {
    ...value,
    code: plaintextCode || value.code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : undefined
  }

  return undefined
}

function getNullableDateString(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return typeof value === 'string' ? value : undefined
}

function parseRegistrationCode(value: unknown, plaintextCode?: string): RegistrationCode | null {
  if (!isRecord(value)) {
    return null
  }

  const id = getString(value.id)
  const code = getString(value.code) || plaintextCode
  const hint = getString(value.hint) || code
  const status = value.status
  const maxUses = getNumber(value.max_uses)
  const usedCount = getNumber(value.used_count)
  const expiresAt = getNullableDateString(value.expires_at)
  const createdBy =
    getString(value.created_by) || getString(value.created_by_user_id) || getString(value.createdBy)
  const createdAt = getString(value.created_at) || getString(value.createdAt)

  if (
    !id ||
    !hint ||
    (status !== 'active' && status !== 'revoked') ||
    maxUses === undefined ||
    usedCount === undefined ||
    expiresAt === undefined ||
    !createdBy ||
    !createdAt
  ) {
    return null
  }

  return {
    id,
    hint,
    code,
    status,
    max_uses: maxUses,
    used_count: usedCount,
    expires_at: expiresAt,
    created_by: createdBy,
    created_at: createdAt
  }
}

function extractListItems(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    return value
  }

  if (!isRecord(value)) {
    return null
  }

  if (Array.isArray(value.items)) {
    return value.items
  }

  if (Array.isArray(value.data)) {
    return value.data
  }

  if (isRecord(value.data) && Array.isArray(value.data.items)) {
    return value.data.items
  }

  return null
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody
    return body.error?.message || body.error?.code || `账号服务请求失败 (${response.status})`
  } catch {
    return `账号服务请求失败 (${response.status})`
  }
}

export class AccountService {
  public getStoredSession(): AccountSession | null {
    const session = getStore().get('session')

    if (!isAccountSession(session) || isSessionExpired(session)) {
      this.clearSession()
      return null
    }

    return session
  }

  public clearSession(): void {
    getStore().set('session', null)
  }

  public getDefaultDeviceName(): string {
    return `${app.getName() || 'SellerFlow'} ${process.platform}`
  }

  public async checkSession(): Promise<SessionCheckResult> {
    const session = this.getStoredSession()

    if (!session) {
      return {
        authenticated: false,
        user: null,
        reason: '未找到有效登录会话。'
      }
    }

    try {
      const user = await this.getCurrentUser()

      if (user.status !== 'active') {
        this.clearSession()
        return {
          authenticated: false,
          user: null,
          reason: '当前账号已被禁用。'
        }
      }

      const nextSession = { ...session, user }
      getStore().set('session', nextSession)

      return {
        authenticated: true,
        user
      }
    } catch (error) {
      this.clearSession()

      return {
        authenticated: false,
        user: null,
        reason: error instanceof Error ? error.message : '账号会话校验失败。'
      }
    }
  }

  public async login(payload: LoginRequest): Promise<AccountSession> {
    const session = await this.request<AccountSession>('/auth/login', {
      method: 'POST',
      auth: false,
      body: {
        ...payload,
        device_name: payload.device_name || this.getDefaultDeviceName()
      },
      validator: isAccountSession
    })

    getStore().set('session', session)
    return session
  }

  public async register(payload: RegisterRequest): Promise<AccountSession> {
    const session = await this.request<AccountSession>('/auth/register', {
      method: 'POST',
      auth: false,
      body: {
        ...payload,
        device_name: payload.device_name || this.getDefaultDeviceName()
      },
      validator: isAccountSession
    })

    getStore().set('session', session)
    return session
  }

  public async logout(allDevices = false): Promise<void> {
    const session = this.getStoredSession()

    if (!session) {
      this.clearSession()
      return
    }

    try {
      await this.request<void>(allDevices ? '/auth/logout-all' : '/auth/logout', {
        method: 'POST',
        auth: true,
        expectsNoContent: true
      })
    } finally {
      this.clearSession()
    }
  }

  public async getCurrentUser(): Promise<AccountUser> {
    return this.request<AccountUser>('/me', {
      method: 'GET',
      auth: true,
      validator: isAccountUser
    })
  }

  public async changePassword(payload: {
    current_password: string
    new_password: string
  }): Promise<void> {
    await this.request<void>('/me/password', {
      method: 'PUT',
      auth: true,
      body: payload,
      expectsNoContent: true
    })
  }

  public async listRegistrationCodes(): Promise<RegistrationCode[]> {
    const response = await this.request<unknown>('/admin/registration-codes', {
      method: 'GET',
      auth: true,
      params: {
        limit: ACCOUNT_API_DEFAULT_LIMIT,
        offset: 0
      },
      validator: (value): value is unknown => extractListItems(value) !== null
    })
    const items = extractListItems(response) || []
    const codes: RegistrationCode[] = []

    for (const code of items) {
      const parsedCode = parseRegistrationCode(code)
      if (!parsedCode) {
        throw new Error('账号服务返回的注册码字段与 openapi.yaml 不匹配。')
      }
      codes.push(parsedCode)
    }

    return codes.map((code) => normalizeRegistrationCode(code))
  }

  public async createRegistrationCode(
    payload: CreateRegistrationCodeRequest
  ): Promise<CreatedRegistrationCode> {
    const response = await this.request<{ code: string; registration_code: unknown }>(
      '/admin/registration-codes',
      {
        method: 'POST',
        auth: true,
        body: payload,
        validator: (value): value is { code: string; registration_code: unknown } =>
          isRecord(value) && typeof value.code === 'string' && 'registration_code' in value
      }
    )
    const registrationCode = parseRegistrationCode(response.registration_code, response.code)

    if (!registrationCode) {
      throw new Error('账号服务返回的新注册码字段与 openapi.yaml 不匹配。')
    }

    return {
      ...response,
      registration_code: normalizeRegistrationCode(registrationCode, response.code)
    }
  }

  public async revokeRegistrationCode(id: string): Promise<void> {
    await this.request<void>(`/admin/registration-codes/${encodeURIComponent(id)}/revoke`, {
      method: 'POST',
      auth: true,
      expectsNoContent: true
    })
  }

  public async listUsers(): Promise<AccountUser[]> {
    const response = await this.request<unknown>('/admin/users', {
      method: 'GET',
      auth: true,
      params: {
        limit: ACCOUNT_API_DEFAULT_LIMIT,
        offset: 0
      },
      validator: (value): value is unknown => {
        const items = extractListItems(value)
        return items !== null && items.every(isAccountUser)
      }
    })
    const items = extractListItems(response) || []

    return items as AccountUser[]
  }

  public async updateUserStatus(id: string, status: AccountUser['status']): Promise<void> {
    await this.request<void>(`/admin/users/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      auth: true,
      body: { status },
      expectsNoContent: true
    })
  }

  public async updateUserRoles(id: string, roles: AccountRole[]): Promise<void> {
    await this.request<void>(`/admin/users/${encodeURIComponent(id)}/roles`, {
      method: 'PUT',
      auth: true,
      body: { roles },
      expectsNoContent: true
    })
  }

  public async revokeUserSessions(id: string): Promise<void> {
    await this.request<void>(`/admin/users/${encodeURIComponent(id)}/sessions/revoke`, {
      method: 'POST',
      auth: true,
      expectsNoContent: true
    })
  }

  public async listAuditLogs(): Promise<AuditLog[]> {
    const response = await this.request<unknown>('/admin/audit-logs', {
      method: 'GET',
      auth: true,
      params: {
        limit: ACCOUNT_API_DEFAULT_LIMIT,
        offset: 0
      },
      validator: (value): value is unknown => {
        const items = extractListItems(value)
        return items !== null && items.every(isAuditLog)
      }
    })
    const items = extractListItems(response) || []

    return items as AuditLog[]
  }

  private async request<T>(
    path: string,
    options: {
      method: string
      auth: boolean
      body?: unknown
      params?: Record<string, string | number>
      validator?: (value: unknown) => value is T
      expectsNoContent?: boolean
    }
  ): Promise<T> {
    const headers = new Headers()
    const session = this.getStoredSession()

    headers.set('Accept', 'application/json')

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    if (options.auth) {
      if (!session) {
        throw new AccountApiError('当前登录会话已失效，请重新登录。', 401)
      }
      headers.set('Authorization', `Bearer ${session.token}`)
    }

    const response = await fetch(createUrl(path, options.params), {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    })

    if (!response.ok) {
      if (response.status === 401) {
        this.clearSession()
      }

      throw new AccountApiError(await readErrorMessage(response), response.status)
    }

    if (options.expectsNoContent || response.status === 204) {
      return undefined as T
    }

    const data: unknown = await response.json()

    if (options.validator && !options.validator(data)) {
      throw new Error('账号服务返回的数据结构与 openapi.yaml 不匹配。')
    }

    return data as T
  }
}

export const accountService = new AccountService()
