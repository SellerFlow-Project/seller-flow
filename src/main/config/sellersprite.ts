export const SELLERSPRITE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export const SELLERSPRITE_VERSION = '5.0.3'
export const SELLERSPRITE_LANGUAGE = 'zh_CN'
export const SELLERSPRITE_EXTENSION_ID = 'ecanjpklimgeijdcdpdfoooofephbbln'
export const SELLERSPRITE_TKK = '500003.1364508470'
export const SELLERSPRITE_SOURCE = 'edge'

export const SELLERSPRITE_LOGIN_BASE_URL = 'https://www.sellersprite.com/v2/extension/signin'
export const SELLERSPRITE_EXTENSION_BASE_URL = 'https://e.sellersprite.com'
export const SELLERSPRITE_QUICK_VIEW_JP_PATH = '/v2/extension/competitor-lookup/quick-view/JP'

export const SELLERSPRITE_RESPONSE_CODE = {
  OK: 'OK',
  NEED_REAUTHORIZED: 'ERR_NEED_RE_AUTHORIZED'
} as const

export const SELLERSPRITE_LOGIN_STATUS = {
  SUCCESS: 'success',
  CREDENTIAL_ERROR: 'credential-error',
  NETWORK_ERROR: 'network-error'
} as const

export const SELLERSPRITE_QUICK_VIEW_STATUS = {
  RESPONSE: 'response',
  NETWORK_ERROR: 'network-error'
} as const

export const SELLERSPRITE_LOGIN_RESULT_CODE = {
  CREDENTIAL_ERROR: 1,
  NETWORK_ERROR: 2
} as const

export const SELLERSPRITE_QUICK_VIEW_QUERY = {
  MINI_MODE: 'false',
  WITH_RELATION: 'true',
  WITH_SALE_TREND: 'false'
} as const

export const SELLERSPRITE_HTTP_HEADER_VALUE = {
  ACCEPT_LANGUAGE: 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6'
} as const

export const SELLERSPRITE_INITIAL_ATTEMPT = 1
export const SELLERSPRITE_LOGIN_MAX_ATTEMPTS = 3
export const SELLERSPRITE_QUICK_VIEW_MAX_ATTEMPTS = 2
export const SELLERSPRITE_RETRY_DELAY_MS = 2000
