export const AUTH_REQUEST_TIMEOUT_MS = 15000
export const AUTH_REQUEST_MAX_ATTEMPTS = 3
export const AUTH_REQUEST_RETRY_DELAY_MS = 1500
export const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
  'Kimlik servisine şu anda ulaşılamıyor. Lütfen biraz sonra tekrar dene.'

const RETRYABLE_AUTH_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504, 521, 522, 523, 524])

type AuthRequestErrorCode = 'timeout' | 'network'

export class AuthRequestError extends Error {
  code: AuthRequestErrorCode

  constructor(message: string, code: AuthRequestErrorCode) {
    super(message)
    this.name = 'AuthRequestError'
    this.code = code
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = AUTH_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AuthRequestError(AUTH_SERVICE_UNAVAILABLE_MESSAGE, 'timeout')
    }
    throw new AuthRequestError(AUTH_SERVICE_UNAVAILABLE_MESSAGE, 'network')
  } finally {
    clearTimeout(timeoutId)
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isRetryableAuthStatus(status: number) {
  return RETRYABLE_AUTH_STATUS_CODES.has(status)
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: {
    timeoutMs?: number
    attempts?: number
    retryDelayMs?: number
  } = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? AUTH_REQUEST_TIMEOUT_MS
  const attempts = Math.max(1, options.attempts ?? AUTH_REQUEST_MAX_ATTEMPTS)
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? AUTH_REQUEST_RETRY_DELAY_MS)

  let lastError: unknown = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(input, init, timeoutMs)
      if (!isRetryableAuthStatus(response.status) || attempt === attempts) {
        return response
      }
    } catch (error) {
      lastError = error
      if (!(error instanceof AuthRequestError) || attempt === attempts) {
        throw error
      }
    }

    if (attempt < attempts) {
      await delay(retryDelayMs * attempt)
    }
  }

  if (lastError) {
    throw lastError
  }

  return fetchWithTimeout(input, init, timeoutMs)
}

export async function readResponsePayload(response: Response): Promise<{
  text: string
  data: unknown
  isJson: boolean
}> {
  const text = await response.text()
  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false
  const data = text && isJson ? JSON.parse(text) : null
  return { text, data, isJson }
}

export function extractAuthErrorMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return ''

  if ('error' in data && typeof data.error === 'string') return data.error
  if ('detail' in data && typeof data.detail === 'string') return data.detail

  const fieldMessages = Object.values(data as Record<string, unknown>)
    .flatMap((value) => {
      if (Array.isArray(value)) return value.map(String)
      if (typeof value === 'string') return [value]
      return []
    })
    .filter(Boolean)

  return fieldMessages[0] ?? ''
}

export function isUnverifiedAccountMessage(message: string): boolean {
  const normalized = message
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  return normalized.includes('dogrulanmadi')
}
