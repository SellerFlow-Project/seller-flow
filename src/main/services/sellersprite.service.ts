import { createHash } from 'crypto'
import {
  SELLERSPRITE_EXTENSION_BASE_URL,
  SELLERSPRITE_EXTENSION_ID,
  SELLERSPRITE_HTTP_HEADER_VALUE,
  SELLERSPRITE_LANGUAGE,
  SELLERSPRITE_LOGIN_BASE_URL,
  SELLERSPRITE_LOGIN_RESULT_CODE,
  SELLERSPRITE_LOGIN_STATUS,
  SELLERSPRITE_QUICK_VIEW_JP_PATH,
  SELLERSPRITE_QUICK_VIEW_QUERY,
  SELLERSPRITE_QUICK_VIEW_STATUS,
  SELLERSPRITE_RESPONSE_CODE,
  SELLERSPRITE_SOURCE,
  SELLERSPRITE_USER_AGENT,
  SELLERSPRITE_VERSION
} from '../config/sellersprite'
import { HTTP_HEADER, HTTP_METHOD, MIME_TYPE } from '../config/http'
import type {
  SellerSpriteBusinessSignature,
  SellerSpriteLoginResult,
  SellerSpriteQuickViewResponse,
  SellerSpriteQuickViewResult
} from '../types/sellersprite'
import { getErrorMessage, isAbortError } from '../utils/error'
import { fetchJson, setUrlSearchParams } from '../utils/http'
import { calculateBusinessTk, calculateSellerSpriteTk } from './sellersprite/signature'

export { calculateBusinessTk, calculateSellerSpriteTk } from './sellersprite/signature'

const MD5_HEX_LENGTH = 32
const MD5_HEX_RE = new RegExp(`^[a-f0-9]{${MD5_HEX_LENGTH}}$`, 'i')

function toMd5Password(password: string): string {
  return MD5_HEX_RE.test(password) ? password : createHash('md5').update(password).digest('hex')
}

function getSellerSpriteErrorMessage(response: SellerSpriteQuickViewResponse): string {
  if (typeof response.message === 'string' && response.message) return response.message
  if (typeof response.error === 'string' && response.error) return response.error
  return '用户名或密码错误'
}

async function fetchSellerSpriteJson(
  input: string | URL,
  init?: RequestInit
): Promise<SellerSpriteQuickViewResponse> {
  const response = await fetchJson<unknown>(input, init)

  if (!response || typeof response !== 'object') {
    throw new Error('卖家精灵接口返回格式异常')
  }

  return response as SellerSpriteQuickViewResponse
}

export class SellerSpriteService {
  private static instance: SellerSpriteService
  private authToken: string = ''

  private constructor() {
    // 单例服务只维护主进程内存级授权 token。
  }

  public static getInstance(): SellerSpriteService {
    if (!SellerSpriteService.instance) {
      SellerSpriteService.instance = new SellerSpriteService()
    }
    return SellerSpriteService.instance
  }

  public setAuthToken(token: string): void {
    this.authToken = token
  }

  public getAuthToken(): string {
    return this.authToken
  }

  /**
   * 计算签名 tk 标记值 (对外暴露 API)
   * @param stringToSign 待签名拼接串
   * @returns 签名的 tk 值
   */
  public getSignatureTk(stringToSign: string): string {
    return calculateSellerSpriteTk(stringToSign)
  }

  /**
   * 计算非登录业务接口签名 tk 与目标字符串
   * @param urlPath 当前请求的 Path
   * @param params 请求参数
   */
  public getBusinessSignatureTk(
    urlPath: string,
    params: Record<string, string>
  ): SellerSpriteBusinessSignature {
    return calculateBusinessTk(urlPath, params)
  }

  /**
   * 卖家精灵登录验证接口
   * @param email 卖家精灵账号邮箱
   * @param password 原始密码或已经经过 MD5 加密后的 32 位密码字符串
   */
  public async login(
    email: string,
    password: string,
    signal?: AbortSignal
  ): Promise<SellerSpriteLoginResult> {
    try {
      const passwordMd5 = toMd5Password(password)
      // 拼接登录签名原始串: email + password_md5
      const stringToSign = email + passwordMd5
      const tk = this.getSignatureTk(stringToSign)

      // 卖家精灵标准登录 API 接口
      const loginUrl = new URL(SELLERSPRITE_LOGIN_BASE_URL)
      setUrlSearchParams(loginUrl, {
        email,
        password: passwordMd5,
        tk,
        version: SELLERSPRITE_VERSION,
        language: SELLERSPRITE_LANGUAGE,
        extension: SELLERSPRITE_EXTENSION_ID,
        source: SELLERSPRITE_SOURCE
      })

      console.log(`[SellerSprite Service] 发起登录请求: email=${email}, tk=${tk}`)

      const resData = await fetchSellerSpriteJson(loginUrl, {
        method: HTTP_METHOD.GET,
        signal,
        headers: {
          [HTTP_HEADER.CONTENT_TYPE]: MIME_TYPE.JSON,
          [HTTP_HEADER.USER_AGENT]: SELLERSPRITE_USER_AGENT,
          [HTTP_HEADER.ACCEPT]: MIME_TYPE.JSON
        }
      })

      if (resData.code === SELLERSPRITE_RESPONSE_CODE.OK) {
        const token = typeof resData.data?.token === 'string' ? resData.data.token : ''
        if (!token) {
          return {
            status: SELLERSPRITE_LOGIN_STATUS.CREDENTIAL_ERROR,
            success: SELLERSPRITE_LOGIN_RESULT_CODE.CREDENTIAL_ERROR,
            message: '登录失败'
          }
        }

        return {
          status: SELLERSPRITE_LOGIN_STATUS.SUCCESS,
          success: true,
          message: '登录成功',
          token,
          data: resData.data || resData
        }
      }

      return {
        status: SELLERSPRITE_LOGIN_STATUS.CREDENTIAL_ERROR,
        success: SELLERSPRITE_LOGIN_RESULT_CODE.CREDENTIAL_ERROR,
        message: getSellerSpriteErrorMessage(resData)
      }
    } catch (error) {
      if (isAbortError(error)) throw error

      console.error('[SellerSprite Service] 登录请求异常:', error)
      return {
        status: SELLERSPRITE_LOGIN_STATUS.NETWORK_ERROR,
        success: SELLERSPRITE_LOGIN_RESULT_CODE.NETWORK_ERROR,
        message: `网络或服务请求异常: ${getErrorMessage(error)}`
      }
    }
  }

  /**
   * 批量获取亚马逊商品在日本站的卖家精灵竞争分析（快速预览）
   * @param asins 商品 ASIN 数组或逗号分隔的字符串
   * @param token 登录获取的授权 token (会被放入 header 中的 auth-token 中)
   *
   * {
   *     "message": "",
   *     "data": {
   *         "total": 1,
   *         "marketplace": "https://www.amazon.co.jp",
   *         "items": [
   *             {
   *                 "month_units": 1000,
   *                 "parent": "B0H2J276RJ",
   *                 "available_days": 87,
   *                 "available": 1772538360000,
   *                 "pkg_dimension_type": "ST",
   *                 "units": 1208,
   *                 "lqs": 95,
   *                 "seller_name": "LGY JP",
   *                 "variations": 1,
   *                 "seller_type": "FBA",
   *                 "currency": "円",
   *                 "bsr_id": "sports",
   *                 "profit": 72.67,
   *                 "brand": "Kihora",
   *                 "dimension": "17.5 x 11.5 x 1.2 cm",
   *                 "pkg_weight": "950 g",
   *                 "seller_id": "A35XGVU9KSLHZW",
   *                 "amount": 3116640.0,
   *                 "fba": 318.0,
   *                 "bsr_cr": 95.31,
   *                 "weight": "950 g",
   *                 "pkg_dimension_type_jp_label": "標準",
   *                 "bsr_label": "スポーツ＆アウトドア",
   *                 "brand_url": "/s/ref=bl_dp_s_web_0?ie=UTF8&search-alias=aps&field-keywords=Kihora",
   *                 "pkg_dimension_type_en_label": "Standard",
   *                 "pkg_volume_weights": 950.0,
   *                 "bsrList": [
   *                     {
   *                         "rank": 96,
   *                         "main": true,
   *                         "id": "sports",
   *                         "label": "スポーツ＆アウトドア",
   *                         "text": "スポーツ＆アウトドア",
   *                         "href": "https://www.amazon.co.jp/gp/bestsellers/sports"
   *                     },
   *                     {
   *                         "rank": 7,
   *                         "main": false,
   *                         "id": "15325741",
   *                         "label": "クーラーボックス用保冷剤",
   *                         "text": "クーラーボックス用保冷剤",
   *                         "href": "https://www.amazon.co.jp/gp/bestsellers/sports/15325741"
   *                     }
   *                 ],
   *                 "bsr_cv": 1951,
   *                 "pkg_dimensions": "18.3 x 12.9 x 3.4 cm",
   *                 "asin": "B0GQHR5MB4",
   *                 "pkg_dimension_type_cn_label": "标准",
   *                 "sellers": 2
   *             }
   *         ]
   *     },
   *     "code": "OK"
   * }
   */
  public async getQuickViewJP(
    asins: string | string[],
    token?: string,
    signal?: AbortSignal
  ): Promise<SellerSpriteQuickViewResult> {
    try {
      const asinsStr = Array.isArray(asins) ? asins.join(',') : asins
      const urlPath = SELLERSPRITE_QUICK_VIEW_JP_PATH

      // 使用业务签名生成器，在有 asins 参数时，源串即为解码后的逗号分隔 ASIN 列表
      const { tk } = this.getBusinessSignatureTk(urlPath, { asins: asinsStr })

      // 卖家精灵 API 全 URL 地址
      const apiUrl = new URL(`${SELLERSPRITE_EXTENSION_BASE_URL}${urlPath}`)
      setUrlSearchParams(apiUrl, {
        asins: asinsStr,
        source: SELLERSPRITE_SOURCE,
        miniMode: SELLERSPRITE_QUICK_VIEW_QUERY.MINI_MODE,
        withRelation: SELLERSPRITE_QUICK_VIEW_QUERY.WITH_RELATION,
        withSaleTrend: SELLERSPRITE_QUICK_VIEW_QUERY.WITH_SALE_TREND,
        tk,
        version: SELLERSPRITE_VERSION,
        language: SELLERSPRITE_LANGUAGE,
        extension: SELLERSPRITE_EXTENSION_ID
      })

      const headers: Record<string, string> = {
        [HTTP_HEADER.USER_AGENT]: SELLERSPRITE_USER_AGENT,
        [HTTP_HEADER.ACCEPT]: MIME_TYPE.JSON,
        [HTTP_HEADER.CONTENT_TYPE]: MIME_TYPE.JSON,
        [HTTP_HEADER.ACCEPT_LANGUAGE]: SELLERSPRITE_HTTP_HEADER_VALUE.ACCEPT_LANGUAGE
      }

      const activeToken = token || this.authToken
      if (activeToken) {
        headers[HTTP_HEADER.AUTH_TOKEN] = activeToken
      }

      const resData = await fetchSellerSpriteJson(apiUrl, {
        method: HTTP_METHOD.GET,
        signal,
        headers
      })

      return {
        status: SELLERSPRITE_QUICK_VIEW_STATUS.RESPONSE,
        success: resData.code === SELLERSPRITE_RESPONSE_CODE.OK,
        data: resData
      }
    } catch (error) {
      if (isAbortError(error)) throw error

      console.error(`[SellerSprite Service] JP 快速竞品分析请求异常:`, error)
      return {
        status: SELLERSPRITE_QUICK_VIEW_STATUS.NETWORK_ERROR,
        success: false,
        error: getErrorMessage(error)
      }
    }
  }
}

export const sellerSpriteService = SellerSpriteService.getInstance()
