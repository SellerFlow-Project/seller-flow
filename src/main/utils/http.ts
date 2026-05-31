interface FetchResponseOptions {
  errorPrefix?: string
}

export function setUrlSearchParams(url: URL, params: Record<string, string>): void {
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value)
  }
}

export async function fetchResponse(
  input: string | URL,
  init?: RequestInit,
  options: FetchResponseOptions = {}
): Promise<Response> {
  const response = await fetch(input, init)

  if (!response.ok) {
    const prefix = options.errorPrefix || 'HTTP 异常'
    throw new Error(`${prefix}，状态码: ${response.status}`)
  }

  return response
}

export async function fetchJson<TResponse>(
  input: string | URL,
  init?: RequestInit,
  options?: FetchResponseOptions
): Promise<TResponse> {
  const response = await fetchResponse(input, init, options)
  return (await response.json()) as TResponse
}

export async function fetchText(
  input: string | URL,
  init?: RequestInit,
  options?: FetchResponseOptions
): Promise<string> {
  const response = await fetchResponse(input, init, options)
  return await response.text()
}
