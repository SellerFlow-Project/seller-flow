import {
  AMAZON_ADDRESS_CHANGE_PAYLOAD,
  AMAZON_BEST_SELLERS_CONTENT_MARKERS,
  AMAZON_CSRF_HEADER,
  AMAZON_FALLBACK_COOKIE_VALUE,
  AMAZON_HTTP_HEADER_VALUE,
  AMAZON_PATH,
  AMAZON_SESSION_COOKIE_NAME,
  AMAZON_UBID_COOKIE_PREFIX,
  AMAZON_USER_AGENT,
  DEFAULT_AMAZON_MARKETPLACE,
  createAmazonBestSellersUrl,
  createAmazonHtmlHeaders,
  createAmazonUrl,
  resolveAmazonMarketplace
} from '../../config/amazon'
import { CRAWLER_HTML_SNIPPET_LENGTH, CRAWLER_HTML_SNIPPET_SUFFIX } from '../../config/crawler'
import { HTTP_HEADER, HTTP_METHOD, MIME_TYPE } from '../../config/http'
import type { AmazonBestSellersPageResult, AmazonCookieResult } from '../../types/amazon'
import {
  findCookieValueByPrefix,
  parseSetCookieHeaders,
  serializeCookies
} from '../../utils/cookie'
import { getErrorMessage, isAbortError } from '../../utils/error'
import { fetchResponse, fetchText } from '../../utils/http'
import { parseBestsellerCategories } from './amazon-parser'

const SOURCE_CSRF_TOKEN_RE = /&quot;anti-csrftoken-a2z&quot;:&quot;(.*?)&quot;/
const ADDRESS_SELECTION_CSRF_TOKEN_RE = /CSRF_TOKEN\s*:\s*"([^"]+)"/

type LogHandler = (log: string) => void

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function getOptionalString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function createCookieProbeHeaders(): Record<string, string> {
  return {
    [HTTP_HEADER.CONTENT_TYPE]: MIME_TYPE.HTML_UTF8,
    [HTTP_HEADER.USER_AGENT]: AMAZON_USER_AGENT,
    [HTTP_HEADER.ACCEPT]: AMAZON_HTTP_HEADER_VALUE.ACCEPT_HTML_COOKIE_PROBE,
    [HTTP_HEADER.ACCEPT_LANGUAGE]: AMAZON_HTTP_HEADER_VALUE.ACCEPT_LANGUAGE
  }
}

function createAddressSelectionHeaders(
  referer: string,
  cookies: string,
  csrfToken: string
): Record<string, string> {
  return {
    [HTTP_HEADER.CONTENT_TYPE]: MIME_TYPE.HTML_UTF8,
    [HTTP_HEADER.REFERER]: referer,
    [HTTP_HEADER.USER_AGENT]: AMAZON_USER_AGENT,
    [HTTP_HEADER.COOKIE]: cookies,
    [AMAZON_CSRF_HEADER]: csrfToken
  }
}

function createAddressChangeHeaders(cookies: string, csrfToken: string): Record<string, string> {
  return {
    [HTTP_HEADER.CONTENT_TYPE]: MIME_TYPE.JSON,
    [HTTP_HEADER.USER_AGENT]: AMAZON_USER_AGENT,
    [HTTP_HEADER.COOKIE]: cookies,
    [AMAZON_CSRF_HEADER]: csrfToken
  }
}

async function parseAddressDescription(
  response: Response,
  marketplace: string,
  fallbackCountry: string
): Promise<string> {
  try {
    const body = (await response.json()) as unknown
    if (!isRecord(body) || !isRecord(body.address)) return `${fallbackCountry} (未知区域)`

    const country = getOptionalString(body.address.countryCode) || marketplace
    const state = getOptionalString(body.address.state)
    const city = getOptionalString(body.address.city)
    const district = getOptionalString(body.address.district)
    return `${country} ${state} ${city} ${district}`.trim()
  } catch {
    return `${fallbackCountry} (未知区域)`
  }
}

export class AmazonClient {
  public async getCookies(
    marketplace: string = DEFAULT_AMAZON_MARKETPLACE,
    onLog: LogHandler = () => undefined,
    signal?: AbortSignal
  ): Promise<AmazonCookieResult> {
    const marketplaceConfig = resolveAmazonMarketplace(marketplace)
    const { domain, zipCode, fallbackCountry, ubidCookieName } = marketplaceConfig
    const cookieProbeUrl = createAmazonUrl(domain, AMAZON_PATH.COOKIE_PROBE)

    onLog(`[系统] 正在进行 ${marketplace} 站点配送地址安全 Cookie 动态握手交换...`)

    try {
      const sessionResponse = await fetchResponse(
        cookieProbeUrl,
        { headers: createCookieProbeHeaders(), signal },
        { errorPrefix: '首页访问失败' }
      )
      const cookieMap = parseSetCookieHeaders(sessionResponse.headers)
      const sessionId = cookieMap.get(AMAZON_SESSION_COOKIE_NAME) || ''
      const cookieHeader = serializeCookies(cookieMap)
      const sourceCsrfToken = (await sessionResponse.text()).match(SOURCE_CSRF_TOKEN_RE)?.[1] || ''
      const csrfToken = await this.getAddressSelectionCsrfToken(
        domain,
        cookieProbeUrl,
        cookieHeader,
        sourceCsrfToken,
        signal
      )
      const addressResponse = await fetchResponse(
        createAmazonUrl(domain, AMAZON_PATH.ADDRESS_CHANGE),
        {
          method: HTTP_METHOD.POST,
          body: JSON.stringify({
            locationType: AMAZON_ADDRESS_CHANGE_PAYLOAD.LOCATION_TYPE,
            zipCode,
            deviceType: AMAZON_ADDRESS_CHANGE_PAYLOAD.DEVICE_TYPE,
            storeContext: AMAZON_ADDRESS_CHANGE_PAYLOAD.STORE_CONTEXT,
            pageType: AMAZON_ADDRESS_CHANGE_PAYLOAD.PAGE_TYPE,
            actionSource: AMAZON_ADDRESS_CHANGE_PAYLOAD.ACTION_SOURCE
          }),
          headers: createAddressChangeHeaders(cookieHeader, csrfToken),
          signal
        },
        { errorPrefix: '地址修改请求失败' }
      )
      const ubid = findCookieValueByPrefix(
        parseSetCookieHeaders(addressResponse.headers),
        AMAZON_UBID_COOKIE_PREFIX
      )

      if (!sessionId || !ubid) {
        throw new Error('必要 Cookie 信息为空')
      }

      return {
        success: true,
        cookies: serializeCookies(
          new Map([
            [ubidCookieName, ubid],
            [AMAZON_SESSION_COOKIE_NAME, sessionId]
          ])
        ),
        address: await parseAddressDescription(addressResponse, marketplace, fallbackCountry)
      }
    } catch (error) {
      if (isAbortError(error)) throw error

      const message = getErrorMessage(error)
      onLog(`[警告] 动态地址 Cookie 交换异常: ${message}。启用降级方案。`)
      return {
        success: false,
        cookies: serializeCookies(
          new Map([
            [ubidCookieName, AMAZON_FALLBACK_COOKIE_VALUE.UBID],
            [AMAZON_SESSION_COOKIE_NAME, AMAZON_FALLBACK_COOKIE_VALUE.SESSION_ID]
          ])
        ),
        address: `${fallbackCountry} (默认备用地址)`,
        error: message
      }
    }
  }

  public async fetchHtml(url: string, cookies: string, signal?: AbortSignal): Promise<string> {
    return await fetchText(
      url,
      { headers: createAmazonHtmlHeaders(cookies), signal },
      { errorPrefix: '页面抓取异常' }
    )
  }

  public async fetchBestSellersPage(
    cookies: string,
    marketplace: string = DEFAULT_AMAZON_MARKETPLACE
  ): Promise<AmazonBestSellersPageResult> {
    try {
      const marketplaceConfig = resolveAmazonMarketplace(marketplace)
      const html = await this.fetchHtml(
        createAmazonBestSellersUrl(marketplaceConfig.baseUrl),
        cookies
      )

      return {
        success: true,
        htmlLength: html.length,
        htmlSnippet: html.substring(0, CRAWLER_HTML_SNIPPET_LENGTH) + CRAWLER_HTML_SNIPPET_SUFFIX,
        isJapanese: AMAZON_BEST_SELLERS_CONTENT_MARKERS.some((marker) => html.includes(marker)),
        categories: parseBestsellerCategories(html, marketplaceConfig.baseUrl)
      }
    } catch (error) {
      return {
        success: false,
        htmlLength: 0,
        htmlSnippet: '',
        isJapanese: false,
        categories: [],
        error: getErrorMessage(error)
      }
    }
  }

  private async getAddressSelectionCsrfToken(
    domain: string,
    referer: string,
    cookies: string,
    sourceCsrfToken: string,
    signal?: AbortSignal
  ): Promise<string> {
    try {
      const html = await fetchText(createAmazonUrl(domain, AMAZON_PATH.ADDRESS_SELECTIONS), {
        headers: createAddressSelectionHeaders(referer, cookies, sourceCsrfToken),
        signal
      })
      return html.match(ADDRESS_SELECTION_CSRF_TOKEN_RE)?.[1] || ''
    } catch (error) {
      if (isAbortError(error)) throw error
      return ''
    }
  }
}

export const amazonClient = new AmazonClient()
