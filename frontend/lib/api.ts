import axios from 'axios'
import { getSession } from 'next-auth/react'
import {
  Application, ApplicationStatus, Listing, Review, UserProfile, DashboardStats,
  BookmarkedListing, FilterState, NotificationPreferences, PaginatedResponse,
} from '@/types'
import { buildQueryString } from './helpers'
import { getBackendApiBaseUrl } from './backend-url'
import {
  AUTH_SERVICE_UNAVAILABLE_MESSAGE,
  extractAuthErrorMessage,
  fetchWithRetry,
  isUnverifiedAccountMessage,
  readResponsePayload,
} from './auth-http'

const browserApiBaseUrl = '/backend-api'
const serverApiBaseUrl = getBackendApiBaseUrl()
const browserPublicApiBaseUrl = browserApiBaseUrl

const api = axios.create({
  baseURL: typeof window === 'undefined' ? serverApiBaseUrl : browserApiBaseUrl,
  headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
})

export function normalizeIucEmail(email: string) {
  return email.trim().toLowerCase()
}

async function postPublicAuth<T>(path: string, payload: unknown): Promise<T> {
  const baseUrl = typeof window === 'undefined' ? serverApiBaseUrl : browserPublicApiBaseUrl
  const response = await fetchWithRetry(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
    credentials: 'include',
  })

  const { text, data, isJson } = await readResponsePayload(response)
  const normalizedErrorMessage = extractAuthErrorMessage(data)

  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error(AUTH_SERVICE_UNAVAILABLE_MESSAGE)
    }
    throw new Error(
      normalizedErrorMessage ||
        (text && !isJson ? 'Sunucu beklenmeyen bir yanit dondurdu.' : '') ||
        `Request failed with status ${response.status}`,
    )
  }

  if (!isJson) {
    throw new Error('Sunucu beklenmeyen bir yanit dondurdu.')
  }

  return data as T
}

function getAccessTokenFromCookie() {
  if (typeof document === 'undefined') {
    return null
  }

  const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

// Attach JWT on every request + abort if session already expired
api.interceptors.request.use(async (config) => {
  if (typeof document !== 'undefined') {
    const session = await getSession()

    // Session sunucu tarafında expire olduysa önceden login'e düşür
    if ((session as any)?.session_error === 'RefreshTokenExpired') {
      window.location.href = '/login?error=SessionExpired'
      return Promise.reject(new Error('SessionExpired'))
    }

    const accessToken = session?.access_token ?? getAccessTokenFromCookie()
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
  }
  return config
})

// 401 gelince reactive refresh + retry; iki kere başarısız olursa login'e yönlendir
let _isRefreshing = false
let _refreshSubscribers: Array<(token: string) => void> = []

function _onRefreshed(token: string) {
  _refreshSubscribers.forEach((cb) => cb(token))
  _refreshSubscribers = []
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config

    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      typeof window !== 'undefined'
    ) {
      originalRequest._retry = true

      if (_isRefreshing) {
        // Başka bir istek halihazırda refresh yapıyor, sıraya gir
        return new Promise((resolve) => {
          _refreshSubscribers.push((newToken: string) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            resolve(api(originalRequest))
          })
        })
      }

      _isRefreshing = true

      try {
        const session = await getSession()
        const refreshToken = (session as any)?.refresh_token

        if (!refreshToken) throw new Error('no_refresh_token')

        const refreshRes = await fetch('/backend-api/auth/token/refresh/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        })

        if (!refreshRes.ok) throw new Error('refresh_failed')

        const { access } = await refreshRes.json()
        _onRefreshed(access)
        originalRequest.headers.Authorization = `Bearer ${access}`
        return api(originalRequest)
      } catch {
        _refreshSubscribers = []
        window.location.href = '/login?error=SessionExpired'
        return Promise.reject(err)
      } finally {
        _isRefreshing = false
      }
    }

    return Promise.reject(err)
  }
)

// ─── Listings ────────────────────────────────────────────────────────────────

export async function fetchListings(
  filters: Partial<FilterState>
): Promise<PaginatedResponse<Listing>> {
  const qs = buildQueryString(filters)
  const { data } = await api.get<PaginatedResponse<Listing>>(`/listings/?${qs}`)
  return data
}

export async function fetchListingById(id: string): Promise<Listing> {
  const { data } = await api.get<Listing>(`/listings/${id}/`)
  return data
}

export interface SimilarListing extends Listing {
  match_reasons: string[]
}

export async function fetchSimilarListings(
  listingId: string
): Promise<SimilarListing[]> {
  const { data } = await api.get<SimilarListing[]>(
    `/listings/${listingId}/similar/`
  )
  return data
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export async function fetchReviews(listingId: string): Promise<Review[]> {
  const { data } = await api.get<PaginatedResponse<Review>>(
    `/reviews/?listing=${listingId}`
  )
  return data.results
}

export async function createReview(
  payload: Omit<Review, 'id' | 'created_at'>
): Promise<Review> {
  const { data } = await api.post<Review>('/reviews/', payload)
  return data
}

// ─── Bookmarks ───────────────────────────────────────────────────────────────

export async function fetchBookmarks(): Promise<BookmarkedListing[]> {
  const { data } = await api.get<
    PaginatedResponse<{
      id: string
      listing: Listing
      bookmarked_at: string
    }>
  >('/bookmarks/')

  return data.results.map(({ listing, bookmarked_at }) => ({
    ...listing,
    bookmarked_at,
  }))
}

export async function addBookmark(listingId: string): Promise<void> {
  await api.post('/bookmarks/', { listing_id: listingId })
}

export async function removeBookmark(listingId: string): Promise<void> {
  await api.delete(`/bookmarks/${listingId}/`)
}

// Applications
export async function fetchApplications(): Promise<Application[]> {
  const { data } = await api.get<PaginatedResponse<Application>>('/applications/')
  return data.results
}

export async function createApplication(payload: {
  listing_id: string
  status?: ApplicationStatus
  notes?: string
}): Promise<Application> {
  const { data } = await api.post<Application>('/applications/', payload)
  return data
}

export async function updateApplication(
  id: string,
  payload: { status?: ApplicationStatus; notes?: string }
): Promise<Application> {
  const { data } = await api.patch<Application>(`/applications/${id}/`, payload)
  return data
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/dashboard/stats/')
  return data
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function fetchUserProfile(): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>('/profile/')
  return data
}

export async function updateUserProfile(
  payload: Partial<UserProfile>
): Promise<UserProfile> {
  const { data } = await api.patch<UserProfile>('/profile/', payload)
  return data
}

export async function uploadCV(file: File): Promise<{ cv_url: string }> {
  const form = new FormData()
  form.append('cv', file)
  const { data } = await api.post<{ cv_url: string }>('/profile/cv/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await api.get<NotificationPreferences>('/profile/notifications/')
  return data
}

export async function updateNotificationPreferences(
  prefs: NotificationPreferences
): Promise<NotificationPreferences> {
  const { data } = await api.put<NotificationPreferences>('/profile/notifications/', prefs)
  return data
}

// ─── Auth helpers ────────────────────────────────────────────────────────────

export async function checkEmailAvailable(email: string): Promise<boolean> {
  const data = await postPublicAuth<{ available: boolean }>(
    '/auth/check-email/', { email: normalizeIucEmail(email) }
  )
  return data.available
}

export async function fetchAccountStatus(email: string): Promise<{
  exists: boolean
  is_verified: boolean
  debug_otp?: string
  delivery_method?: string
}> {
  return postPublicAuth<{
    exists: boolean
    is_verified: boolean
    debug_otp?: string
    delivery_method?: string
  }>(
    '/auth/account-status/', { email: normalizeIucEmail(email) }
  )
}

export type CredentialLoginProbeResult =
  | { ok: true }
  | {
      ok: false
      reason: 'invalid_credentials' | 'unverified' | 'service_unavailable'
      message: string
    }

export async function probeCredentialsLogin(
  email: string,
  password: string
): Promise<CredentialLoginProbeResult> {
  const baseUrl = typeof window === 'undefined' ? serverApiBaseUrl : browserPublicApiBaseUrl

  try {
    const response = await fetchWithRetry(`${baseUrl}/auth/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({
        email: normalizeIucEmail(email),
        iuc_email: normalizeIucEmail(email),
        password,
      }),
      cache: 'no-store',
      credentials: 'include',
    })

    if (response.ok) {
      return { ok: true }
    }

    const { text, data, isJson } = await readResponsePayload(response)
    const normalizedErrorMessage =
      extractAuthErrorMessage(data) ||
      (text && !isJson ? text : '')

    if (response.status >= 500) {
      return {
        ok: false,
        reason: 'service_unavailable',
        message: AUTH_SERVICE_UNAVAILABLE_MESSAGE,
      }
    }

    if (isUnverifiedAccountMessage(normalizedErrorMessage)) {
      return {
        ok: false,
        reason: 'unverified',
        message: 'Hesabın kayıtlı ama e-posta doğrulaman tamamlanmamış.',
      }
    }

    return {
      ok: false,
      reason: 'invalid_credentials',
      message: 'E-posta veya şifre hatalı',
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'service_unavailable',
      message:
        error instanceof Error && error.message
          ? error.message
          : AUTH_SERVICE_UNAVAILABLE_MESSAGE,
    }
  }
}

export async function registerUser(payload: {
  full_name: string
  email: string
  password: string
  student_no: string
  department_year: number
  linkedin_url?: string
}): Promise<{ delivery_method?: string; debug_otp?: string }> {
  return postPublicAuth<{ delivery_method?: string; debug_otp?: string }>('/auth/register/', {
    ...payload,
    email: normalizeIucEmail(payload.email),
  })
}

export async function verifyOTP(email: string, otp: string): Promise<void> {
  await postPublicAuth('/auth/verify-otp/', { email: normalizeIucEmail(email), otp })
}

export async function resendOTP(
  email: string
): Promise<{ delivery_method?: string; debug_otp?: string }> {
  return postPublicAuth<{ delivery_method?: string; debug_otp?: string }>(
    '/auth/resend-otp/',
    { email: normalizeIucEmail(email) }
  )
}

export async function forgotPassword(email: string): Promise<void> {
  await postPublicAuth('/auth/forgot-password/', { email: normalizeIucEmail(email) })
}

export async function resetPassword(
  token: string,
  password: string
): Promise<void> {
  await postPublicAuth('/auth/reset-password/', { token, password })
}

export default api
