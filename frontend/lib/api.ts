import axios from 'axios'
import { getSession } from 'next-auth/react'
import {
  Application, ApplicationStatus, InternshipJournal, Listing, Review, UserProfile, DashboardStats,
  BookmarkedListing, FilterState, NotificationPreferences, PaginatedResponse,
} from '@/types'
import { buildQueryString } from './helpers'
import { getBackendApiBaseUrl } from './backend-url'

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
  const response = await fetch(`${baseUrl}${path}`, {
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

  const text = await response.text()
  const isJson = response.headers.get('content-type')?.includes('application/json')
  const data = text && isJson ? JSON.parse(text) : null

  const normalizedErrorMessage = (() => {
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
  })()

  if (!response.ok) {
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

// Attach JWT on every request
api.interceptors.request.use(async (config) => {
  if (typeof document !== 'undefined') {
    const session = await getSession()
    const accessToken = session?.access_token ?? getAccessTokenFromCookie()
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
  }
  return config
})

// Redirect on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login'
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

export async function fetchInternshipJournals(listingId?: string): Promise<InternshipJournal[]> {
  const query = listingId ? `?listing=${listingId}` : ''
  const { data } = await api.get<PaginatedResponse<InternshipJournal>>(`/journals/${query}`)
  return data.results
}

export async function createInternshipJournal(payload: {
  listing_id?: string
  title: string
  content: string
  internship_year: number
  is_anonymous: boolean
}): Promise<InternshipJournal> {
  const { data } = await api.post<InternshipJournal>('/journals/', payload)
  return data
}

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
