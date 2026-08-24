/**
 * Thin fetch wrapper for the `/api/admin/*` BFF surface (single same-origin
 * API via CloudFront — see design.md). The session is an httpOnly cookie
 * set by the server; this client NEVER reads, stores, or inspects it —
 * `credentials: 'include'` is enough for the browser to send it
 * automatically. A 401 response is the sole signal used to detect
 * "not logged in" (see `ApiError.status`).
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor (status: number, code: string | undefined, message?: string) {
    super(message ?? code ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export interface ApiFetchOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

async function parseJsonSafely (response: Response): Promise<any> {
  const text = await response.text()
  if (text.length === 0) {
    return undefined
  }
  return JSON.parse(text)
}

export async function apiFetch<T = unknown> (path: string, options: ApiFetchOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  })

  if (response.status === 204) {
    return undefined as T
  }

  const parsedBody = await parseJsonSafely(response)

  if (!response.ok) {
    const code = typeof parsedBody?.error === 'string' ? parsedBody.error : undefined
    const message = typeof parsedBody?.message === 'string' ? parsedBody.message : undefined
    throw new ApiError(response.status, code, message)
  }

  return parsedBody as T
}
