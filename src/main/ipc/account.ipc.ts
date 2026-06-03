import { IPC_CHANNEL } from '../config/ipc'
import { accountService } from '../services/account.service'
import { handleIpc } from './ipc-handler'
import type {
  AccountRole,
  AccountUser,
  CreateRegistrationCodeRequest,
  LoginRequest,
  RegisterRequest
} from '../../shared/account'

export function registerAccountIPC(): void {
  handleIpc(IPC_CHANNEL.ACCOUNT.CHECK_SESSION, () => accountService.checkSession())
  handleIpc(IPC_CHANNEL.ACCOUNT.GET_CURRENT_USER, () => accountService.getCurrentUser())
  handleIpc<[LoginRequest], Awaited<ReturnType<typeof accountService.login>>>(
    IPC_CHANNEL.ACCOUNT.LOGIN,
    (_event, payload) => accountService.login(payload)
  )
  handleIpc<[RegisterRequest], Awaited<ReturnType<typeof accountService.register>>>(
    IPC_CHANNEL.ACCOUNT.REGISTER,
    (_event, payload) => accountService.register(payload)
  )
  handleIpc<[boolean | undefined], void>(IPC_CHANNEL.ACCOUNT.LOGOUT, (_event, allDevices) =>
    accountService.logout(allDevices)
  )
  handleIpc<[{ current_password: string; new_password: string }], void>(
    IPC_CHANNEL.ACCOUNT.CHANGE_PASSWORD,
    (_event, payload) => accountService.changePassword(payload)
  )
  handleIpc(IPC_CHANNEL.ACCOUNT.LIST_REGISTRATION_CODES, () =>
    accountService.listRegistrationCodes()
  )
  handleIpc<
    [CreateRegistrationCodeRequest],
    Awaited<ReturnType<typeof accountService.createRegistrationCode>>
  >(IPC_CHANNEL.ACCOUNT.CREATE_REGISTRATION_CODE, (_event, payload) =>
    accountService.createRegistrationCode(payload)
  )
  handleIpc<[string], void>(IPC_CHANNEL.ACCOUNT.REVOKE_REGISTRATION_CODE, (_event, id) =>
    accountService.revokeRegistrationCode(id)
  )
  handleIpc(IPC_CHANNEL.ACCOUNT.LIST_USERS, () => accountService.listUsers())
  handleIpc<[string, AccountUser['status']], void>(
    IPC_CHANNEL.ACCOUNT.UPDATE_USER_STATUS,
    (_event, id, status) => accountService.updateUserStatus(id, status)
  )
  handleIpc<[string, AccountRole[]], void>(
    IPC_CHANNEL.ACCOUNT.UPDATE_USER_ROLES,
    (_event, id, roles) => accountService.updateUserRoles(id, roles)
  )
  handleIpc<[string], void>(IPC_CHANNEL.ACCOUNT.REVOKE_USER_SESSIONS, (_event, id) =>
    accountService.revokeUserSessions(id)
  )
  handleIpc(IPC_CHANNEL.ACCOUNT.LIST_AUDIT_LOGS, () => accountService.listAuditLogs())
}
