import { HTTP_HEADER, HTTP_METHOD, MIME_TYPE } from '../config/http'
import { fetchJson } from '../utils/http'
import type {
  AmazonSearchConfig,
  Amz123LoginCode,
  Amz123LoginStatus,
  Amz123Session
} from '../../shared/amazon-search'
import { saveAmz123Session } from './amazon-search-settings.service'

const LOGIN_CODE_URL = 'https://api.amz123.com/user/v1/account/wechat/login_code'
const QR_STATUS_URL = 'https://api.amz123.com/user/v1/account/wechat/qrlogin_status'
const HOTWORDS_URL = 'https://api.amz123.com/search/v1/hotwords/search'
const HOTWORDS_PAGE_SIZE = 200

export interface Amz123HotwordRow {
  word: string
  raw: Record<string, unknown>
}

export interface Amz123HotwordPage {
  rows: Amz123HotwordRow[]
  total: number
}

export interface Amz123RangeRequest {
  rankingRange: number[]
  fluctuationRange: number[]
  rankingLabel: string
  fluctuationLabel: string
}

interface Amz123ApiEnvelope {
  status?: number
  message?: string
  data?: unknown
}

const RANK_RANGE_MAP = new Map<string, number[]>([
  ['全部', []],
  ['1-1000', [1, 1000]],
  ['1001-10000', [1001, 10000]],
  ['10001-50000', [10001, 50000]],
  ['50000以上', [50001]]
])

const FLUCTUATION_RANGE_MAP = new Map<string, number[]>([
  ['全部', []],
  ['1-50', [1, 50]],
  ['51-100', [51, 100]],
  ['101-1000', [101, 1000]],
  ['1000以上', [1001]]
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function normalizeRoleIds(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((item) => getNumber(item)).filter((item): item is number => item !== undefined)
    : []
}

function normalizeSession(data: Record<string, unknown>): Amz123Session {
  const token = getString(data.token)
  const username = getString(data.username)
  const expire = getNumber(data.expire)

  if (!token || !username || !expire) {
    throw new Error('AMZ123 登录成功，但返回的 token/用户名/过期时间不完整。')
  }

  return {
    token,
    username,
    avatar: getString(data.avatar) || undefined,
    expire,
    appUid: getNumber(data.app_uid),
    roleIdList: normalizeRoleIds(data.role_id_list)
  }
}

function normalizeHotwordRow(value: unknown): Amz123HotwordRow | null {
  if (!isRecord(value)) return null

  const word =
    getString(value.word) ||
    getString(value.keyword) ||
    getString(value.search_word) ||
    getString(value.name)

  if (!word) return null

  return {
    word,
    raw: value
  }
}

function assertEnvelopeOk(envelope: Amz123ApiEnvelope, fallbackMessage: string): unknown {
  if (envelope.status === 0 || envelope.status === undefined) return envelope.data

  throw new Error(envelope.message || fallbackMessage)
}

function getSelectedRangeLabels(selected: string[], fallback: string): string[] {
  const normalized = selected.filter((item) => item && item !== '全部')
  return normalized.length > 0 ? normalized : [fallback]
}

export function buildAmz123RangeRequests(config: AmazonSearchConfig): Amz123RangeRequest[] {
  const rankLabels = getSelectedRangeLabels(config.selectedRanks, '全部')
  const fluctuationLabels = getSelectedRangeLabels(config.selectedChanges, '全部')
  const requests: Amz123RangeRequest[] = []

  for (const rankingLabel of rankLabels) {
    for (const fluctuationLabel of fluctuationLabels) {
      requests.push({
        rankingLabel,
        fluctuationLabel,
        rankingRange: RANK_RANGE_MAP.get(rankingLabel) || [],
        fluctuationRange: FLUCTUATION_RANGE_MAP.get(fluctuationLabel) || []
      })
    }
  }

  return requests
}

class Amz123Service {
  public async requestLoginCode(signal?: AbortSignal): Promise<Amz123LoginCode> {
    const response = await fetchJson<Amz123ApiEnvelope>(LOGIN_CODE_URL, { signal })
    const data = assertEnvelopeOk(response, 'AMZ123 二维码获取失败。')

    if (!isRecord(data)) {
      throw new Error('AMZ123 二维码接口返回的数据结构异常。')
    }

    const ticket = getString(data.ticket)
    const imageBase64 = getString(data.img_data)

    if (!ticket || !imageBase64) {
      throw new Error('AMZ123 二维码接口未返回 ticket 或二维码图片。')
    }

    return {
      ticket,
      imageDataUrl: `data:image/png;base64,${imageBase64}`
    }
  }

  public async pollLoginStatus(ticket: string, signal?: AbortSignal): Promise<Amz123LoginStatus> {
    const response = await fetchJson<Amz123ApiEnvelope>(
      QR_STATUS_URL,
      {
        method: HTTP_METHOD.POST,
        headers: {
          [HTTP_HEADER.CONTENT_TYPE]: MIME_TYPE.JSON
        },
        body: JSON.stringify({ ticket, type: 3 }),
        signal
      },
      { errorPrefix: 'AMZ123 登录状态轮询失败' }
    )
    const data = assertEnvelopeOk(response, 'AMZ123 登录状态接口返回异常。')

    if (!isRecord(data)) {
      throw new Error('AMZ123 登录状态接口返回的数据结构异常。')
    }

    const action = getNumber(data.action) ?? 0
    if (action === 1) {
      const session = saveAmz123Session(normalizeSession(data))
      return {
        action,
        message: '登录成功',
        session
      }
    }

    if (action === -1) {
      return {
        action,
        message: '二维码已过期，请刷新后重新扫码。'
      }
    }

    return {
      action,
      message: '等待扫码确认。'
    }
  }

  public async fetchHotwordPage(
    token: string,
    config: AmazonSearchConfig,
    range: Amz123RangeRequest,
    pageNumber: number,
    signal?: AbortSignal
  ): Promise<Amz123HotwordPage> {
    const response = await fetchJson<Amz123ApiEnvelope>(
      HOTWORDS_URL,
      {
        method: HTTP_METHOD.POST,
        headers: {
          [HTTP_HEADER.CONTENT_TYPE]: MIME_TYPE.JSON,
          Authorization: token
        },
        body: JSON.stringify({
          word: '',
          country: config.marketplace.toLowerCase(),
          ranking_this_week: range.rankingRange,
          fluctuation_range: range.fluctuationRange,
          word_len_range: [],
          click_range: [],
          conversion_range: [],
          ne_word: '',
          top3_brand: '',
          top3_category: '',
          fluctuation_use_abs: 1,
          page: {
            size: HOTWORDS_PAGE_SIZE,
            num: pageNumber,
            sorts: [{ condition: 'new_rank', order: 1 }]
          }
        }),
        signal
      },
      { errorPrefix: 'AMZ123 搜索词接口请求失败' }
    )
    const data = assertEnvelopeOk(response, 'AMZ123 搜索词接口返回异常。')

    if (!isRecord(data)) {
      throw new Error('AMZ123 搜索词接口返回的数据结构异常。')
    }

    const rows = Array.isArray(data.rows)
      ? data.rows.map(normalizeHotwordRow).filter((item): item is Amz123HotwordRow => Boolean(item))
      : []
    const total = getNumber(data.total) ?? rows.length

    return { rows, total }
  }
}

export const amz123Service = new Amz123Service()
