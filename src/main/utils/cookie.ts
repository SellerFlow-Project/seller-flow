export function parseSetCookieHeaders(headers: Headers): Map<string, string> {
  const cookies = new Map<string, string>()

  for (const header of headers.getSetCookie()) {
    const [cookiePair] = header.split(';')
    const separatorIndex = cookiePair.indexOf('=')

    if (separatorIndex <= 0) continue

    const name = cookiePair.slice(0, separatorIndex).trim()
    const value = cookiePair.slice(separatorIndex + 1).trim()
    cookies.set(name, value)
  }

  return cookies
}

export function serializeCookies(cookies: ReadonlyMap<string, string>): string {
  return Array.from(cookies, ([name, value]) => `${name}=${value}`).join('; ')
}

export function findCookieValueByPrefix(
  cookies: ReadonlyMap<string, string>,
  prefix: string
): string {
  for (const [name, value] of cookies) {
    if (name.startsWith(prefix)) return value
  }

  return ''
}
