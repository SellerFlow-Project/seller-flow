import { contextBridge, ipcRenderer, webFrame } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  isApplicationSettings,
  isSellerFlowSettings,
  type ApplicationSettings,
  type SellerFlowSettings,
  type SettingsApi
} from '../shared/settings'
import {
  isAccountSession,
  isAccountUser,
  isAuditLog,
  isCreatedRegistrationCode,
  isRegistrationCode,
  isSessionCheckResult,
  type AccountApi
} from '../shared/account'
import {
  isDataSharingStatus,
  isSharedDataSource,
  type DataSharingApi
} from '../shared/data-sharing'
import type { AppUpdateApi, AppUpdateState } from '../shared/update'
import {
  isMihomoProxyNode,
  isMihomoRuntimeStatus,
  type MihomoApi
} from '../shared/mihomo'

// Custom APIs for renderer
const updates: AppUpdateApi = {
  getState: () => ipcRenderer.invoke('update:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  quitAndInstall: () => ipcRenderer.invoke('update:quit-and-install'),
  onStateChange: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppUpdateState): void => {
      callback(state)
    }

    ipcRenderer.on('update:state', listener)
    return () => ipcRenderer.removeListener('update:state', listener)
  }
}

function getIpcErrorMessage(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('success' in value)) {
    return undefined
  }

  const response = value as { success?: boolean; error?: unknown; message?: unknown }
  if (response.success !== false) {
    return undefined
  }

  return typeof response.error === 'string'
    ? response.error
    : typeof response.message === 'string'
      ? response.message
      : '主进程未能完成配置操作。'
}

async function invokeSettings<T>(
  channel: string,
  args: unknown[],
  validator: (value: unknown) => value is T
): Promise<T> {
  const response: unknown = await ipcRenderer.invoke(channel, ...args)
  const errorMessage = getIpcErrorMessage(response)

  if (errorMessage) {
    throw new Error(errorMessage)
  }

  if (!validator(response)) {
    throw new Error('主进程返回了不完整的配置数据。')
  }

  return response
}

const settings: SettingsApi = {
  get: (): Promise<SellerFlowSettings> => invokeSettings('settings:get', [], isSellerFlowSettings),
  save: (nextSettings): Promise<SellerFlowSettings> =>
    invokeSettings('settings:save', [nextSettings], isSellerFlowSettings),
  updateApplication: (nextSettings): Promise<ApplicationSettings> =>
    invokeSettings('settings:update-application', [nextSettings], isApplicationSettings)
}

async function invokeAccount<T>(
  channel: string,
  args: unknown[],
  validator?: (value: unknown) => value is T
): Promise<T> {
  const response: unknown = await ipcRenderer.invoke(channel, ...args)
  const errorMessage = getIpcErrorMessage(response)

  if (errorMessage) {
    throw new Error(errorMessage)
  }

  if (validator && !validator(response)) {
    throw new Error('主进程返回了不完整的账号数据。')
  }

  return response as T
}

const account: AccountApi = {
  checkSession: () => invokeAccount('account:check-session', [], isSessionCheckResult),
  getCurrentUser: () => invokeAccount('account:get-current-user', [], isAccountUser),
  login: (payload) => invokeAccount('account:login', [payload], isAccountSession),
  register: (payload) => invokeAccount('account:register', [payload], isAccountSession),
  logout: (allDevices) => invokeAccount('account:logout', [allDevices]),
  changePassword: (payload) => invokeAccount('account:change-password', [payload]),
  listRegistrationCodes: () =>
    invokeAccount(
      'account:list-registration-codes',
      [],
      (value): value is Awaited<ReturnType<AccountApi['listRegistrationCodes']>> =>
        Array.isArray(value) && value.every(isRegistrationCode)
    ),
  createRegistrationCode: (payload) =>
    invokeAccount('account:create-registration-code', [payload], isCreatedRegistrationCode),
  revokeRegistrationCode: (id) => invokeAccount('account:revoke-registration-code', [id]),
  listUsers: () =>
    invokeAccount(
      'account:list-users',
      [],
      (value): value is Awaited<ReturnType<AccountApi['listUsers']>> =>
        Array.isArray(value) && value.every(isAccountUser)
    ),
  updateUserStatus: (id, status) => invokeAccount('account:update-user-status', [id, status]),
  updateUserRoles: (id, roles) => invokeAccount('account:update-user-roles', [id, roles]),
  revokeUserSessions: (id) => invokeAccount('account:revoke-user-sessions', [id]),
  listAuditLogs: () =>
    invokeAccount(
      'account:list-audit-logs',
      [],
      (value): value is Awaited<ReturnType<AccountApi['listAuditLogs']>> =>
        Array.isArray(value) && value.every(isAuditLog)
    )
}

const dataSharing: DataSharingApi = {
  getStatus: () => invokeAccount('data-sharing:get-status', [], isDataSharingStatus),
  discoverSources: () =>
    invokeAccount(
      'data-sharing:discover-sources',
      [],
      (value): value is Awaited<ReturnType<DataSharingApi['discoverSources']>> =>
        Array.isArray(value) && value.every(isSharedDataSource)
    ),
  getRemoteTasks: (source) => invokeAccount('data-sharing:get-remote-tasks', [source]),
  getRemoteCategories: (source, taskId) =>
    invokeAccount('data-sharing:get-remote-categories', [source, taskId]),
  getRemoteSellerTypes: (source, taskId) =>
    invokeAccount('data-sharing:get-remote-seller-types', [source, taskId]),
  queryRemoteProducts: (source, filter) =>
    invokeAccount('data-sharing:query-remote-products', [source, filter]),
  getRemoteProductBsrRanks: (source, productId) =>
    invokeAccount('data-sharing:get-remote-product-bsr-ranks', [source, productId]),
  markRemoteProductAsRead: (source, productId) =>
    invokeAccount('data-sharing:mark-remote-product-read', [source, productId])
}

const mihomo: MihomoApi = {
  getStatus: () => invokeAccount('mihomo:get-status', [], isMihomoRuntimeStatus),
  refreshSubscription: () =>
    invokeAccount('mihomo:refresh-subscription', [], isMihomoRuntimeStatus),
  listNodes: () =>
    invokeAccount(
      'mihomo:list-nodes',
      [],
      (value): value is Awaited<ReturnType<MihomoApi['listNodes']>> =>
        Array.isArray(value) && value.every(isMihomoProxyNode)
    ),
  testNode: (nodeId) => invokeAccount('mihomo:test-node', [nodeId], isMihomoProxyNode)
}

const api = {
  account,
  dataSharing,
  mihomo,
  settings,
  updates
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('webFrame', {
      setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor)
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore - define in dts
  window.webFrame = {
    setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor)
  }
}
