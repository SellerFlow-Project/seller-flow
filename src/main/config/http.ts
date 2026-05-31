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

export const MIME_TYPE = {
  JSON: 'application/json',
  HTML_UTF8: 'text/html;charset=UTF-8'
} as const
