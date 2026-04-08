'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { X } from 'lucide-react'
import {
  createApplication,
  fetchApplications,
  fetchBookmarks,
  fetchDashboardStats,
  fetchUserProfile,
  removeBookmark,
  updateApplication,
} from '@/lib/api'
import {
  Application,
  ApplicationStatus,
  BookmarkedListing,
  DashboardStats,
  UserProfile,
} from '@/types'
import { daysUntilDeadline, getAvatarColor, getDeadlineDisplay, getInitials, FOCUS_AREA_LABELS, FOCUS_AREA_COLORS, PLATFORM_LABELS, timeAgoTurkish } from '@/lib/helpers'
import ProfileDropdown from '@/components/ProfileDropdown'
import UniversityLogo from '@/components/UniversityLogo'
function BookmarkCard({
  listing,
  onRemove,
  onTrack,
  isTracked,
}: {
  listing: BookmarkedListing
  onRemove: () => void
  onTrack: () => void
  isTracked: boolean
}) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const deadline = getDeadlineDisplay(listing)
  const initials = getInitials(listing.company_name)
  const avatarColor = getAvatarColor(listing.company_name)
  const focusLabel = FOCUS_AREA_LABELS[listing.em_focus_area]
  const focusColor = FOCUS_AREA_COLORS[listing.em_focus_area] ?? 'bg-gray-100 text-gray-600'
  const platformLabel = PLATFORM_LABELS[listing.source_platform] ?? listing.source_platform

  return (
    <div
      onClick={() => router.push(`/listings/${listing.id}`)}
      className={`group cursor-pointer rounded-xl border bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-campus-sm dark:bg-white/5 ${
        deadline.color === 'red' ? 'border-red-200 dark:border-red-400/30' : 'border-gray-100 hover:border-[#d8ad43]/25 dark:border-[#d8ad43]/12 dark:hover:border-[#d8ad43]/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-100 text-[10px] font-semibold dark:border-[#d8ad43]/15 ${avatarColor}`}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-800 group-hover:text-[#1E3A5F] dark:text-[#e7edf4] dark:group-hover:text-[#d8ad43]">
            {listing.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-[#e7edf4]/50">{listing.company_name}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
          {deadline.label ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                deadline.color === 'red'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-gray-50 text-gray-500'
              }`}
            >
              {deadline.label}
            </span>
          ) : null}
          {confirm ? (
            <div className="flex gap-1">
              <button
                onClick={() => {
                  onRemove()
                  setConfirm(false)
                }}
                className="rounded border border-red-200 px-2 py-0.5 text-[10px] text-red-500 hover:bg-red-50"
              >
                Kaldır
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-400 hover:bg-gray-50"
              >
                İptal
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirm(true)}
              className="rounded p-0.5 text-gray-300 hover:text-red-400"
              title="Kayıttan kaldır"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {listing.bookmarked_at && (
        <p className="mt-2 text-right text-[9px] text-gray-300 dark:text-[#e7edf4]/30">
          Kaydedildi: {timeAgoTurkish(listing.bookmarked_at)}
        </p>
      )}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={isTracked}
          onClick={(e) => {
            e.stopPropagation()
            onTrack()
          }}
          className="rounded-md border border-[#1E3A5F]/25 px-2 py-1 text-[10px] font-medium text-[#1E3A5F] hover:bg-[#1E3A5F]/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#d8ad43]/35 dark:text-[#d8ad43]"
        >
          {isTracked ? 'Takipte' : 'Takibe Al'}
        </button>
      </div>
    </div>
  )
}

const APPLICATION_STATUSES: Array<{ key: ApplicationStatus; label: string }> = [
  { key: 'basvurdum', label: 'Başvurdum' },
  { key: 'mulakat', label: 'Mülakat' },
  { key: 'kabul', label: 'Kabul' },
  { key: 'ret', label: 'Ret' },
]

export default function DashboardPage() {
  const router = useRouter()
  const { status } = useSession()
  const [showAll, setShowAll] = useState(false)
  const [addAppOpen, setAddAppOpen] = useState(false)
  const [addAppSearch, setAddAppSearch] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [router, status])

  const shouldFetchProtectedData = status === 'authenticated'

  const { data: statsData } = useSWR<DashboardStats>(
    shouldFetchProtectedData ? 'dashboard-stats' : null,
    fetchDashboardStats
  )
  const { data: profileData } = useSWR<UserProfile>(
    shouldFetchProtectedData ? 'profile' : null,
    fetchUserProfile
  )
  const {
    data: bookmarksData,
    mutate: mutateBookmarks,
  } = useSWR<BookmarkedListing[]>(
    shouldFetchProtectedData ? 'bookmarks' : null,
    fetchBookmarks
  )
  const {
    data: applicationsData,
    mutate: mutateApplications,
  } = useSWR<Application[]>(
    shouldFetchProtectedData ? 'applications' : null,
    fetchApplications
  )

  const stats = statsData ?? null
  const profile = profileData ?? null
  const bookmarks = bookmarksData ?? []
  const applications = applicationsData ?? []

  // Sort bookmarks: urgent deadlines first, then by bookmarked_at desc
  const sortedBookmarks = [...bookmarks].sort((a, b) => {
    const urgencyOrder: Record<string, number> = { urgent: 0, upcoming: 1, normal: 2, unknown: 3, expired: 4 }
    const aU = urgencyOrder[a.deadline_status] ?? 3
    const bU = urgencyOrder[b.deadline_status] ?? 3
    if (aU !== bU) return aU - bU
    return new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime()
  })
  const approachingDeadlineBookmarks = sortedBookmarks.filter((bookmark) => {
    const days = daysUntilDeadline(bookmark.application_deadline)
    return days !== null && days >= 0 && days < 7
  })
  const visibleBookmarks = showAll ? sortedBookmarks : sortedBookmarks.slice(0, 5)
  const trackedListingIds = new Set(applications.map((item) => item.listing.id))
  const firstName = profile?.full_name.split(' ')[0] ?? 'Öğrenci'

  async function handleRemove(id: string) {
    const optimisticBookmarks = bookmarks.filter((bookmark) => bookmark.id !== id)
    await mutateBookmarks(
      async (current = []) => {
        await removeBookmark(id)
        return current.filter((bookmark) => bookmark.id !== id)
      },
      {
        optimisticData: optimisticBookmarks,
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      }
    )
  }

  async function handleTrackApplication(listingId: string) {
    await createApplication({ listing_id: listingId, status: 'basvurdum' })
    mutateApplications()
  }

  async function handleUpdateApplication(
    applicationId: string,
    payload: { status?: ApplicationStatus; notes?: string }
  ) {
    await updateApplication(applicationId, payload)
    mutateApplications()
  }

  const missingHints: Record<string, string> = {
    cv: '+ CV ekle',
    linkedin: '+ LinkedIn ekle',
    student_no: '+ Öğrenci no ekle',
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-sm text-gray-500 dark:text-[#e7edf4]/50">
        Dashboard yükleniyor...
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f9f9ff] dark:bg-[#0e1e33]">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-30 bg-[#1A233A] shadow-md" style={{ borderBottom: '2px solid transparent', borderImage: 'linear-gradient(to right, #B8860B, #F3E5AB, #B8860B) 1' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-0 sm:px-6" style={{ height: '64px' }}>
          <Link href="/listings" className="flex items-center gap-4">
            <UniversityLogo className="h-10 w-10 shrink-0 rounded border border-[#D4AF37] p-0.5" />
            <div className="min-w-0">
              <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37] sm:text-sm">
                İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA
              </span>
              <p className="truncate text-[9px] tracking-wider text-gray-300 sm:text-xs">
                ENDÜSTRİ MÜHENDİSLİĞİ STAJ PLATFORMU
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-8">
            <div className="hidden items-center gap-8 sm:flex">
              {[
                { label: 'İlanlar', href: '/listings' },
                { label: 'Başvurular', href: '/dashboard' },
                { label: 'Profil', href: '/profile' },
              ].map((nav) => (
                <Link
                  key={nav.href}
                  href={nav.href}
                  className={`text-sm font-medium transition-colors ${
                    nav.href === '/dashboard'
                      ? 'border-b-2 border-[#D4AF37] pb-1 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {nav.label}
                </Link>
              ))}
            </div>
            <ProfileDropdown />
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">

        {/* ── Welcome + Stats ── */}
        <div className="mb-8">
          <h1 className="campus-heading text-2xl font-bold text-[#132843] dark:text-[#e7edf4]">
            Hoş geldin, <span className="text-[#d8ad43]">{firstName}</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#e7edf4]/50">
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'AKTİF İLAN', value: stats?.total_active_listings ?? '-', accent: false },
            { label: 'KAYITLI İLAN', value: stats?.bookmarks_count ?? '-', accent: false },
            { label: 'BUGÜN YENİ', value: stats?.new_listings_today ?? '-', accent: false },
            { label: 'SÜRESİ DOLACAK', value: stats?.listings_expiring_soon ?? '-', accent: true },
          ].map(({ label, value, accent }) => (
            <div
              key={label}
              className={`rounded-xl border p-5 text-center transition-all hover:shadow-sm ${
                accent ? 'border-red-200 bg-red-50 dark:border-red-800/30 dark:bg-red-900/20' : 'border-gray-200 bg-white dark:border-white/10 dark:bg-[#1a2d45]'
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#e7edf4]/40">{label}</p>
              <p className={`mt-1 text-3xl font-bold ${accent ? 'text-red-600 dark:text-red-400' : 'text-[#132843] dark:text-[#e7edf4]'}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Başvuru Takip Panosu ── */}
        <div id="applications" className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="campus-heading text-lg font-bold text-[#132843] dark:text-[#e7edf4]">Başvuru Takip Panosu</h2>
            <button
              onClick={() => setAddAppOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#132843] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1E3A5F] dark:bg-[#132843] dark:text-white dark:hover:bg-[#1E3A5F]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Yeni Başvuru Ekle
            </button>
          </div>

          {/* ── Add Application Modal ── */}
          {addAppOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setAddAppOpen(false); setAddAppSearch('') }}>
              <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-[#1a2d45] dark:shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#132843] dark:text-[#e7edf4]">Yeni Başvuru Ekle</h3>
                  <button onClick={() => { setAddAppOpen(false); setAddAppSearch('') }} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-[#e7edf4]/40 dark:hover:bg-white/10 dark:hover:text-[#e7edf4]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="İlan veya şirket ara..."
                  value={addAppSearch}
                  onChange={(e) => setAddAppSearch(e.target.value)}
                  className="mb-3 h-9 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#132843] dark:border-white/10 dark:bg-[#0e1e33] dark:text-[#e7edf4] dark:focus:border-[#d8ad43]/40"
                  autoFocus
                />
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {(() => {
                    const untrackedBookmarks = bookmarks.filter((b) => !trackedListingIds.has(b.id))
                    const filtered = addAppSearch.trim()
                      ? untrackedBookmarks.filter((b) =>
                          b.title.toLowerCase().includes(addAppSearch.toLowerCase()) ||
                          b.company_name.toLowerCase().includes(addAppSearch.toLowerCase())
                        )
                      : untrackedBookmarks
                    if (untrackedBookmarks.length === 0) {
                      return (
                        <div className="py-6 text-center">
                          <p className="text-sm text-gray-500 dark:text-[#e7edf4]/50">Tüm kayıtlı ilanlar zaten takipte</p>
                          <button
                            onClick={() => { setAddAppOpen(false); router.push('/listings') }}
                            className="mt-2 text-xs font-medium text-[#d8ad43] hover:underline"
                          >
                            İlanlara göz at
                          </button>
                        </div>
                      )
                    }
                    if (filtered.length === 0) {
                      return <p className="py-4 text-center text-sm text-gray-400 dark:text-[#e7edf4]/40">Sonuç bulunamadı</p>
                    }
                    return filtered.map((b) => (
                      <button
                        key={b.id}
                        onClick={async () => {
                          await handleTrackApplication(b.id)
                          setAddAppOpen(false)
                          setAddAppSearch('')
                        }}
                        className="flex w-full items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5 text-left transition-all hover:border-[#d8ad43]/30 hover:bg-[#d8ad43]/5 dark:border-white/8 dark:hover:border-[#d8ad43]/30"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-[#132843] dark:bg-white/8 dark:text-[#e7edf4]">
                          {getInitials(b.company_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#132843] dark:text-[#e7edf4]">{b.title}</p>
                          <p className="truncate text-[11px] text-gray-500 dark:text-[#e7edf4]/50">{b.company_name}</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-gray-300 dark:text-[#e7edf4]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    ))
                  })()}
                </div>
              </div>
            </div>
          )}

          {applications.length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-[#1a2d45] dark:text-[#e7edf4]/50">
              Henüz takipte bir başvuru yok. Kaydedilen ilanlardan &quot;Takibe Al&quot; ile ekleyebilirsin.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {APPLICATION_STATUSES.map((column) => {
                const columnItems = applications.filter((item) => item.status === column.key)
                const borderColor =
                  column.key === 'basvurdum' ? 'border-t-blue-500' :
                  column.key === 'mulakat' ? 'border-t-yellow-500' :
                  column.key === 'kabul' ? 'border-t-green-500' :
                  'border-t-red-500'
                const badgeColor =
                  column.key === 'basvurdum' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                  column.key === 'mulakat' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                  column.key === 'kabul' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                return (
                  <div key={column.key} className={`rounded-xl border border-gray-200 border-t-[3px] bg-white p-3 dark:border-white/10 dark:bg-[#1a2d45] ${borderColor}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#132843] dark:text-[#e7edf4]">{column.label}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>
                        {columnItems.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {columnItems.length === 0 ? (
                        <p className="rounded-lg bg-gray-50 px-3 py-3 text-center text-[11px] text-gray-400 dark:bg-white/5 dark:text-[#e7edf4]/40">Kayıt yok</p>
                      ) : (
                        columnItems.map((item) => (
                          <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 dark:border-white/8 dark:bg-white/5">
                            <button type="button" onClick={() => router.push(`/listings/${item.listing.id}`)} className="w-full text-left">
                              <p className="line-clamp-2 text-xs font-semibold text-[#132843] dark:text-[#e7edf4]">{item.listing.title}</p>
                              <p className="mt-0.5 text-[10px] text-gray-500 dark:text-[#e7edf4]/50">{item.listing.company_name}</p>
                            </button>
                            {item.notes && (
                              <p className="mt-1 rounded bg-yellow-50 px-2 py-1 text-[10px] text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">{item.notes}</p>
                            )}
                            <select
                              value={item.status}
                              onChange={(event) => handleUpdateApplication(item.id, { status: event.target.value as ApplicationStatus })}
                              className="mt-2 h-7 w-full rounded-lg border border-gray-200 bg-white px-2 text-[11px] text-[#132843] outline-none dark:border-white/10 dark:bg-[#0e1e33] dark:text-[#e7edf4]"
                            >
                              {APPLICATION_STATUSES.map((s) => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Kaydedilen İlanlar ── */}
        <div id="saved" className="mb-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="campus-heading text-lg font-bold text-[#132843] dark:text-[#e7edf4]">
              Kaydedilen İlanlar
              {bookmarks.length > 0 && <span className="ml-2 text-gray-400 dark:text-[#e7edf4]/40">({bookmarks.length})</span>}
            </h2>
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/listings')} className="rounded-lg bg-[#132843] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1E3A5F] dark:bg-[#132843] dark:text-white dark:hover:bg-[#1E3A5F]">
                + İlan Keşfet
              </button>
            </div>
          </div>

          {approachingDeadlineBookmarks.length > 0 ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-400/20 dark:bg-red-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-300">Son başvuru tarihi yaklaşıyor</p>
                  <p className="text-xs text-red-600/80 dark:text-red-200/80">
                    7 günden az kalan kaydedilmiş ilanlar burada görünüyor.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">
                  {approachingDeadlineBookmarks.length} ilan
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {approachingDeadlineBookmarks.slice(0, 3).map((bookmark) => {
                  const deadline = getDeadlineDisplay(bookmark)
                  return (
                    <button
                      key={`approaching-${bookmark.id}`}
                      type="button"
                      onClick={() => router.push(`/listings/${bookmark.id}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 text-left hover:bg-white dark:bg-[#132843]/40 dark:hover:bg-[#132843]/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#132843] dark:text-[#e7edf4]">{bookmark.title}</p>
                        <p className="truncate text-[11px] text-gray-500 dark:text-[#e7edf4]/50">{bookmark.company_name}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-600 dark:bg-red-900/40 dark:text-red-200">
                        {deadline.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {!bookmarks || bookmarks.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-12 text-center dark:border-white/10 dark:bg-[#1a2d45]">
              <p className="mb-2 text-sm font-medium text-gray-500 dark:text-[#e7edf4]/50">Henüz kaydettiğin ilan yok</p>
              <p className="mb-4 text-xs text-gray-400 dark:text-[#e7edf4]/40">İlanlara göz at ve beğendiklerini kaydet</p>
              <button onClick={() => router.push('/listings')} className="rounded-lg bg-[#132843] px-5 py-2.5 text-xs font-bold text-white dark:bg-[#d8ad43] dark:text-[#10223b]">
                İlanlara Göz At
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleBookmarks.map((bookmark) => {
                const initials = getInitials(bookmark.company_name)
                const isTracked = trackedListingIds.has(bookmark.id)
                return (
                  <div
                    key={bookmark.id}
                    onClick={() => router.push(`/listings/${bookmark.id}`)}
                    className="group flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-all hover:shadow-sm sm:items-center sm:gap-4 sm:px-5 dark:border-white/10 dark:bg-[#1a2d45]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-[#132843] dark:bg-white/8 dark:text-[#e7edf4]">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 break-words text-sm font-semibold leading-5 text-[#132843] group-hover:text-[#1E3A5F] sm:line-clamp-1 dark:text-[#e7edf4] dark:group-hover:text-[#d8ad43]">
                        {bookmark.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-[#e7edf4]/50">{bookmark.company_name}</p>
                    </div>
                    <div className="flex shrink-0 items-start gap-2 pt-0.5 sm:items-center sm:pt-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(bookmark.id) }}
                        aria-label="İlanı çıkar"
                        title="İlanı çıkar"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-[#132843] transition-colors hover:bg-gray-50 hover:text-red-500 dark:border-white/10 dark:text-[#e7edf4] dark:hover:bg-white/5 dark:hover:text-red-300"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                )
              })}
              {!showAll && bookmarks.length > 5 && (
                <button onClick={() => setShowAll(true)} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 dark:text-[#e7edf4]/40 dark:hover:text-[#e7edf4]/60">
                  {bookmarks.length - 5} ilan daha göster
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
