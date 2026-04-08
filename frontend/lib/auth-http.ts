export const AUTH_REQUEST_TIMEOUT_MS = 8000
export const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
  'Kimlik servisine şu anda ulaşılamıyor. Lütfen biraz sonra tekrar dene.'

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
