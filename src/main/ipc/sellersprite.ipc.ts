import { sellerSpriteService } from '../services/sellersprite.service'
import { handleIpc } from './ipc-handler'

/**
 * 卖家精灵 API 模块 IPC 监听注册
 * 提供签名运算、账号联机验证登录以及 API 请求抓取的进程通信通道
 */
export function registerSellerSpriteIPC(): void {
  handleIpc('sellersprite:calculate-tk', (_event, { stringToSign }) => {
    return { success: true, tk: sellerSpriteService.getSignatureTk(stringToSign) }
  })

  handleIpc('sellersprite:calculate-business-tk', (_event, { urlPath, params }) => {
    return { success: true, ...sellerSpriteService.getBusinessSignatureTk(urlPath, params || {}) }
  })

  handleIpc(
    'sellersprite:login',
    async (_event, { email, passwordMd5 }) => {
      return await sellerSpriteService.login(email, passwordMd5)
    },
    { errorField: 'message', errorPrefix: '登录桥接通道异常' }
  )

  handleIpc(
    'sellersprite:get-quick-view',
    async (_event, { asins, cookie }) => {
      return await sellerSpriteService.getQuickViewJP(asins, cookie)
    },
    { errorPrefix: '竞品数据请求桥接通道异常' }
  )
}
