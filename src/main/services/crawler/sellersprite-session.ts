import { SELLERSPRITE_ACCOUNT_STATUS } from '../../config/database'
import {
  SELLERSPRITE_LOGIN_MAX_ATTEMPTS,
  SELLERSPRITE_LOGIN_STATUS,
  SELLERSPRITE_INITIAL_ATTEMPT,
  SELLERSPRITE_QUICK_VIEW_MAX_ATTEMPTS,
  SELLERSPRITE_QUICK_VIEW_STATUS,
  SELLERSPRITE_RESPONSE_CODE,
  SELLERSPRITE_RETRY_DELAY_MS
} from '../../config/sellersprite'
import type { CrawlerProgressHandler } from '../../types/crawler'
import type { SellerSpriteQuickViewResponse } from '../../types/sellersprite'
import { getErrorMessage } from '../../utils/error'
import { sleep } from '../../utils/time'
import { databaseService } from '../database.service'
import { sellerSpriteService } from '../sellersprite.service'
import { SellerSpriteAuthenticationError, SellerSpriteRetryExhaustedError } from './errors'

export class SellerSpriteSessionService {
  public async fetchQuickViewWithRetry(
    asins: string[],
    onProgress: CrawlerProgressHandler,
    signal?: AbortSignal
  ): Promise<SellerSpriteQuickViewResponse> {
    let token = await this.ensureSession(onProgress, signal)
    let attempt = SELLERSPRITE_INITIAL_ATTEMPT

    while (attempt <= SELLERSPRITE_QUICK_VIEW_MAX_ATTEMPTS) {
      const result = await sellerSpriteService.getQuickViewJP(asins, token, signal)

      if (result.status === SELLERSPRITE_QUICK_VIEW_STATUS.NETWORK_ERROR) {
        onProgress(
          `[卖家精灵] ⚠️ 网络连接异常或服务无响应 (Attempt ${attempt}/${SELLERSPRITE_QUICK_VIEW_MAX_ATTEMPTS}): ${result.error}`
        )
        attempt++
        if (attempt <= SELLERSPRITE_QUICK_VIEW_MAX_ATTEMPTS) {
          await sleep(SELLERSPRITE_RETRY_DELAY_MS, signal)
          continue
        }
        throw new SellerSpriteRetryExhaustedError(result.error)
      }

      const code = result.data.code
      if (code === SELLERSPRITE_RESPONSE_CODE.OK) {
        return result.data
      }

      if (code === SELLERSPRITE_RESPONSE_CODE.NEED_REAUTHORIZED) {
        onProgress(
          `[卖家精灵] 🔑 会话 Auth-Token 已失效 (${SELLERSPRITE_RESPONSE_CODE.NEED_REAUTHORIZED})，正在触发自动重新登录轮换机制...`
        )
        sellerSpriteService.setAuthToken('')
        token = await this.rotateLogin(onProgress, signal)
        attempt++
        continue
      }

      onProgress(
        `[卖家精灵] ⚠️ 请求接口返回异常 code [${code}]: ${result.data.message || '未知错误'}`
      )
      throw new Error(`SellerSprite API error code: ${code}`)
    }

    throw new SellerSpriteRetryExhaustedError(
      'Failed to fetch SellerSprite quick view after re-authorization'
    )
  }

  private async ensureSession(
    onProgress: CrawlerProgressHandler,
    signal?: AbortSignal
  ): Promise<string> {
    const currentToken = sellerSpriteService.getAuthToken()
    return currentToken || (await this.rotateLogin(onProgress, signal))
  }

  private async rotateLogin(
    onProgress: CrawlerProgressHandler,
    signal?: AbortSignal
  ): Promise<string> {
    const accounts = databaseService
      .querySpriteAccounts()
      .filter((account) => account.status === SELLERSPRITE_ACCOUNT_STATUS.NORMAL)

    if (accounts.length === 0) {
      onProgress(`[卖家精灵] ❌ 失败：数据库中已无正常状态的卖家精灵账号！`)
      throw new SellerSpriteAuthenticationError('No available SellerSprite accounts')
    }

    for (const account of accounts) {
      onProgress(`[卖家精灵] 👤 尝试使用账号 [${account.username}] 进行登录授权...`)

      let attempt = SELLERSPRITE_INITIAL_ATTEMPT
      while (attempt <= SELLERSPRITE_LOGIN_MAX_ATTEMPTS) {
        const result = await sellerSpriteService.login(account.username, account.password, signal)

        if (result.status === SELLERSPRITE_LOGIN_STATUS.SUCCESS) {
          sellerSpriteService.setAuthToken(result.token)
          onProgress(
            `[卖家精灵] 🎉 账号 [${account.username}] 登录成功！已获取并缓存会话 Auth-Token`
          )
          return result.token
        }

        if (result.status === SELLERSPRITE_LOGIN_STATUS.NETWORK_ERROR) {
          onProgress(
            `[卖家精灵] ⚠️ 账号 [${account.username}] 登录时遭遇网络异常 (Attempt ${attempt}/${SELLERSPRITE_LOGIN_MAX_ATTEMPTS}): ${result.message}`
          )
          attempt++
          if (attempt <= SELLERSPRITE_LOGIN_MAX_ATTEMPTS) {
            await sleep(SELLERSPRITE_RETRY_DELAY_MS, signal)
          }
          continue
        }

        onProgress(`[卖家精灵] ❌ 账号 [${account.username}] 凭证失效或密码错误：${result.message}`)
        this.markAccountInvalid(account.id, account.username, onProgress)
        break
      }

      if (attempt > SELLERSPRITE_LOGIN_MAX_ATTEMPTS) {
        onProgress(
          `[卖家精灵] ⚠️ 账号 [${account.username}] 连续 ${SELLERSPRITE_LOGIN_MAX_ATTEMPTS} 次网络异常，跳过此账号。`
        )
      }
    }

    onProgress(`[卖家精灵] ❌ 严重错误：数据库中所有的正常卖家精灵账号均登录失败，无法完成授权！`)
    throw new SellerSpriteAuthenticationError('All SellerSprite accounts failed to authenticate')
  }

  private markAccountInvalid(
    accountId: number,
    username: string,
    onProgress: CrawlerProgressHandler
  ): void {
    try {
      databaseService.updateSpriteAccountStatus(accountId, SELLERSPRITE_ACCOUNT_STATUS.INVALID)
      onProgress(`[数据库] 🔴 已将失效账号 [${username}] 状态自动标记为「已失效」`)
    } catch (error) {
      onProgress(`[数据库] 警告：标记账号状态失败: ${getErrorMessage(error)}`)
    }
  }
}

export const sellerSpriteSessionService = new SellerSpriteSessionService()
