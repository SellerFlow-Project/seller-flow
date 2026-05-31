import { IPC_CHANNEL } from '../config/ipc'
import { sellerSpriteService } from '../services/sellersprite.service'
import { createIpcSuccess, handleIpc } from './ipc-handler'

interface SignaturePayload {
  stringToSign: string
}

interface BusinessSignaturePayload {
  urlPath: string
  params?: Record<string, string>
}

interface LoginPayload {
  email: string
  passwordMd5: string
}

interface QuickViewPayload {
  asins: string | string[]
  cookie?: string
}

/**
 * 卖家精灵 API 模块 IPC 监听注册
 * 提供签名运算、账号联机验证登录以及 API 请求抓取的进程通信通道
 */
export function registerSellerSpriteIPC(): void {
  handleIpc(IPC_CHANNEL.SELLERSPRITE.CALCULATE_TK, (_event, { stringToSign }: SignaturePayload) => {
    return createIpcSuccess({ tk: sellerSpriteService.getSignatureTk(stringToSign) })
  })

  handleIpc(
    IPC_CHANNEL.SELLERSPRITE.CALCULATE_BUSINESS_TK,
    (_event, { urlPath, params }: BusinessSignaturePayload) => {
      return createIpcSuccess(sellerSpriteService.getBusinessSignatureTk(urlPath, params || {}))
    }
  )

  handleIpc(
    IPC_CHANNEL.SELLERSPRITE.LOGIN,
    async (_event, { email, passwordMd5 }: LoginPayload) => {
      return await sellerSpriteService.login(email, passwordMd5)
    },
    { errorField: 'message', errorPrefix: '登录桥接通道异常' }
  )

  handleIpc(
    IPC_CHANNEL.SELLERSPRITE.GET_QUICK_VIEW,
    async (_event, { asins, cookie }: QuickViewPayload) => {
      return await sellerSpriteService.getQuickViewJP(asins, cookie)
    },
    { errorPrefix: '竞品数据请求桥接通道异常' }
  )
}
