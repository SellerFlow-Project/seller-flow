export const HTTP_METHOD = {
  GET: 'GET',
  POST: 'POST'
} as const

export const HTTP_HEADER = {
  ACCEPT: 'Accept',
  ACCEPT_LANGUAGE: 'Accept-Language',
  AUTH_TOKEN: 'auth-token',
  CONTENT_TYPE: 'Content-Type',
  COOKIE: 'Cookie',
  REFERER: 'Referer',
  USER_AGENT: 'User-Agent'
} as const

export const HTTP_RETRY_STATUS = new Set([429, 503, 403, 500])

export const HTTP_RETRY_POLICY = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 10_000,
  JITTER_MS: 300,
  RETRY_AFTER_SECONDS_TO_MS: 1000
} as const

export const MIME_TYPE = {
  JSON: 'application/json',
  HTML_UTF8: 'text/html;charset=UTF-8'
} as const
