export type AuthStage = 'splash' | 'login' | 'register' | 'main'

export type AccountRole = 'user' | 'staff' | 'admin' | 'super_admin'

export type AccountPermission =
  | 'dashboard:view'
  | 'crawler:amazon'
  | 'data:browse'
  | 'data:delete'
  | 'ai:use'
  | 'sellersprite:manage'
  | 'settings:manage'
  | 'account:self'
  | 'admin:registration_codes'
  | 'admin:users'
  | 'admin:audit_logs'

export interface AccountUser {
  id: string
  login_name: string
  status: 'active' | 'disabled'
  roles: AccountRole[]
  created_at: string
  updated_at: string
}

export interface AccountSession {
  token: string
  expires_at: string
  user: AccountUser
}

export interface LoginRequest {
  login_name: string
  password: string
  device_name?: string
}

export interface RegisterRequest extends LoginRequest {
  registration_code: string
}

export interface RegistrationCode {
  id: string
  hint: string
  code?: string
  status: 'active' | 'revoked'
  max_uses: number
  used_count: number
  expires_at: string | null
  created_by: string
  created_at: string
}

export interface CreateRegistrationCodeRequest {
  max_uses: number
  expires_at: string | null
}

export interface CreatedRegistrationCode {
  code: string
  registration_code: RegistrationCode
}

export interface AuditLog {
  id: number
  actor_user_id: string | null
  action: string
  target_type: string
  target_id: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface SessionCheckResult {
  authenticated: boolean
  user: AccountUser | null
  reason?: string
}

export interface AccountApi {
  checkSession: () => Promise<SessionCheckResult>
  getCurrentUser: () => Promise<AccountUser>
  login: (payload: LoginRequest) => Promise<AccountSession>
  register: (payload: RegisterRequest) => Promise<AccountSession>
  logout: (allDevices?: boolean) => Promise<void>
  changePassword: (payload: { current_password: string; new_password: string }) => Promise<void>
  listRegistrationCodes: () => Promise<RegistrationCode[]>
  createRegistrationCode: (
    payload: CreateRegistrationCodeRequest
  ) => Promise<CreatedRegistrationCode>
  revokeRegistrationCode: (id: string) => Promise<void>
  listUsers: () => Promise<AccountUser[]>
  updateUserStatus: (id: string, status: AccountUser['status']) => Promise<void>
  updateUserRoles: (id: string, roles: AccountRole[]) => Promise<void>
  revokeUserSessions: (id: string) => Promise<void>
  listAuditLogs: () => Promise<AuditLog[]>
}

export const ROLE_PERMISSIONS: Record<AccountRole, AccountPermission[]> = {
  user: ['dashboard:view', 'crawler:amazon', 'data:browse', 'ai:use', 'account:self'],
  staff: [
    'dashboard:view',
    'crawler:amazon',
    'data:browse',
    'ai:use',
    'sellersprite:manage',
    'account:self'
  ],
  admin: [
    'dashboard:view',
    'crawler:amazon',
    'data:browse',
    'data:delete',
    'ai:use',
    'sellersprite:manage',
    'settings:manage',
    'account:self',
    'admin:registration_codes',
    'admin:users',
    'admin:audit_logs'
  ],
  super_admin: [
    'dashboard:view',
    'crawler:amazon',
    'data:browse',
    'data:delete',
    'ai:use',
    'sellersprite:manage',
    'settings:manage',
    'account:self',
    'admin:registration_codes',
    'admin:users',
    'admin:audit_logs'
  ]
}

export function getPermissionsForRoles(roles: readonly string[]): AccountPermission[] {
  const permissions = new Set<AccountPermission>()

  roles.forEach((role) => {
    const rolePermissions = ROLE_PERMISSIONS[role as AccountRole]
    rolePermissions?.forEach((permission) => permissions.add(permission))
  })

  return Array.from(permissions)
}

export function hasPermission(
  user: AccountUser | null | undefined,
  permission: AccountPermission
): boolean {
  if (!user || user.status !== 'active') {
    return false
  }

  return getPermissionsForRoles(user.roles).includes(permission)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAccountRole(value: unknown): value is AccountRole {
  return value === 'user' || value === 'staff' || value === 'admin' || value === 'super_admin'
}

export function isAccountUser(value: unknown): value is AccountUser {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.login_name === 'string' &&
    (value.status === 'active' || value.status === 'disabled') &&
    Array.isArray(value.roles) &&
    value.roles.every(isAccountRole) &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string'
  )
}

export function isAccountSession(value: unknown): value is AccountSession {
  return (
    isRecord(value) &&
    typeof value.token === 'string' &&
    typeof value.expires_at === 'string' &&
    isAccountUser(value.user)
  )
}

export function isSessionCheckResult(value: unknown): value is SessionCheckResult {
  if (!isRecord(value) || typeof value.authenticated !== 'boolean') {
    return false
  }

  return (
    (value.user === null || isAccountUser(value.user)) &&
    (value.reason === undefined || typeof value.reason === 'string')
  )
}

export function isRegistrationCode(value: unknown): value is RegistrationCode {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.hint === 'string' &&
    (value.code === undefined || typeof value.code === 'string') &&
    (value.status === 'active' || value.status === 'revoked') &&
    typeof value.max_uses === 'number' &&
    typeof value.used_count === 'number' &&
    (value.expires_at === null || typeof value.expires_at === 'string') &&
    typeof value.created_by === 'string' &&
    typeof value.created_at === 'string'
  )
}

export function isCreatedRegistrationCode(value: unknown): value is CreatedRegistrationCode {
  return (
    isRecord(value) && typeof value.code === 'string' && isRegistrationCode(value.registration_code)
  )
}

export function isAuditLog(value: unknown): value is AuditLog {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    (value.actor_user_id === null || typeof value.actor_user_id === 'string') &&
    typeof value.action === 'string' &&
    typeof value.target_type === 'string' &&
    typeof value.target_id === 'string' &&
    isRecord(value.metadata) &&
    typeof value.created_at === 'string'
  )
}
