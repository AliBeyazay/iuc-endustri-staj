'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import {
  fetchBookmarks,
  fetchDashboardStats,
  fetchUserProfile,
  removeBookmark,
  updateUserProfile,
  uploadCV,
} from '@/lib/api'
import { BookmarkedListing, DashboardStats, UserProfile } from '@/types'
import { getAvatarColor, getDeadlineDisplay, getInitials, FOCUS_AREA_LABELS, FOCUS_AREA_COLORS, PLATFORM_LABELS, timeAgoTurkish } from '@/lib/helpers'
import ProfileDropdown from '@/components/ProfileDropdown'
import UniversityLogo from '@/components/UniversityLogo'

function BookmarkCard({
  listing,
  onRemove,
}: {
  listing: BookmarkedListing
  onRemove: () => void
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
      className={`group cursor-pointer rounded-xl border bg-white p-3 transition-all hover:shadow-md ${
        deadline.color === 'red' ? 'border-red-200' : 'border-gray-100'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-100 text-[10px] font-semibold ${avatarColor}`}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-800 group-hover:text-[#1E3A5F]">
            {listing.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-500">{listing.company_name}</p>
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
        <p className="mt-2 text-right text-[9px] text-gray-300">
          Kaydedildi: {timeAgoTurkish(listing.bookmarked_at)}
        </p>
      )}
    </div>
  )
}

function ProfileEdit({
  profile,
  onSaved,
}: {
  profile: UserProfile
  onSaved: () => void
}) {
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedin_url ?? '')
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      if (cvFile) {
        await uploadCV(cvFile)
      }
      await updateUserProfile({ linkedin_url: linkedinUrl || undefined })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-gray-100 p-3">
      <div>
        <label className="mb-1 block text-xs text-gray-500">LinkedIn URL</label>
        <input
          value={linkedinUrl}
          onChange={(event) => setLinkedinUrl(event.target.value)}
          placeholder="https://linkedin.com/in/..."
          className="h-8 w-full rounded border border-gray-200 px-2.5 text-xs focus:border-[#1E3A5F] focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">
          CV Yükle <span className="text-gray-400">(PDF, maks 5MB)</span>
        </label>
        <input
          type="file"
          accept=".pdf"
          onChange={(event) => setCvFile(event.target.files?.[0] ?? null)}
          className="text-xs text-gray-500 file:mr-2 file:rounded file:border file:border-gray-200 file:px-2 file:py-1 file:text-xs"
        />
        {profile.cv_url ? (
          <p className="mt-1 text-[10px] text-gray-400">
            Mevcut CV var -{' '}
            <a
              href={profile.cv_url}
              target="_blank"
              rel="noreferrer"
              className="text-[#1E3A5F]"
            >
              Görüntüle
            </a>
          </p>
        ) : null}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="h-8 w-full rounded bg-[#1E3A5F] text-xs text-white disabled:opacity-50"
      >
        {saving ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { status } = useSession()
  const [showAll, setShowAll] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

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
  const { data: profileData, mutate: mutateProfile } = useSWR<UserProfile>(
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

  const stats = statsData ?? null
  const profile = profileData ?? null
  const bookmarks = bookmarksData ?? []

  // Sort bookmarks: urgent deadlines first, then by bookmarked_at desc
  const sortedBookmarks = [...bookmarks].sort((a, b) => {
    const urgencyOrder: Record<string, number> = { urgent: 0, upcoming: 1, normal: 2, unknown: 3, expired: 4 }
    const aU = urgencyOrder[a.deadline_status] ?? 3
    const bU = urgencyOrder[b.deadline_status] ?? 3
    if (aU !== bU) return aU - bU
    return new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime()
  })
  const visibleBookmarks = showAll ? sortedBookmarks : sortedBookmarks.slice(0, 5)
  const firstName = profile?.full_name.split(' ')[0] ?? 'Ogrenci'

  async function handleRemove(id: string) {
    await removeBookmark(id)
    mutateBookmarks()
  }

  const missingHints: Record<string, string> = {
    cv: '+ CV ekle',
    linkedin: '+ LinkedIn ekle',
    student_no: '+ Ogrenci no ekle',
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-sm text-gray-500">
        Dashboard yükleniyor...
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="campus-shell min-h-screen">
      <nav className="campus-nav sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <Link href="/listings" className="relative z-10 flex min-w-0 items-center gap-3">
          <UniversityLogo className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" />
          <div className="min-w-0">
            <span className="campus-brand block truncate text-sm leading-tight sm:text-2xl sm:leading-none">
              {'\u0130stanbul \u00dcniversitesi Cerrahpa\u015fa'}
            </span>
            <p className="truncate text-[8px] uppercase tracking-[0.18em] text-[#f4e3b3]/80 sm:text-[10px] sm:tracking-[0.28em]">
              {'End\u00fcstri M\u00fchendisli\u011fi Staj Platformu'}
            </p>
          </div>
        </Link>
        <ProfileDropdown />
      </nav>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-3 py-4 sm:px-4 sm:py-5 lg:grid-cols-[1fr_260px] lg:gap-5">
        <div className="space-y-4">
          <div id="saved" className="campus-card scroll-mt-24 rounded-2xl p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-base font-medium text-gray-900">Hoş geldin, {firstName}</h1>
                <p className="mt-0.5 text-xs text-gray-400">
                  {new Date().toLocaleDateString('tr-TR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {profile?.is_verified ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-medium text-blue-800">
                    Doğrulandı
                  </span>
                ) : null}
                {profile?.department_year ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-medium text-gray-600">
                    {profile.department_year}. Sınıf
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[
                {
                  label: 'Aktif İlan',
                  value: stats?.total_active_listings ?? '-',
                  cls: 'text-[#1E3A5F]',
                },
                {
                  label: 'Kayıtlı İlan',
                  value: stats?.bookmarks_count ?? '-',
                  cls: 'text-[#1E3A5F]',
                },
                {
                  label: 'Bugün Yeni',
                  value: stats?.new_listings_today ?? '-',
                  cls: stats?.new_listings_today ? 'text-green-700' : 'text-[#1E3A5F]',
                },
                {
                  label: 'Süresi Dolacak',
                  value: stats?.listings_expiring_soon ?? '-',
                  cls: stats?.listings_expiring_soon ? 'text-red-600' : 'text-[#1E3A5F]',
                },
              ].map(({ label, value, cls }) => (
                <div key={label} className="rounded-lg bg-gray-50 p-2.5 text-center">
                  <p className={`text-2xl font-medium ${cls}`}>{value}</p>
                  <p className="mt-0.5 text-[9px] text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div id="profile" className="campus-card scroll-mt-24 rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-gray-800">
                  Kaydedilen İlanlar
                  {bookmarks.length > 0 ? (
                    <span className="ml-1.5 text-xs text-gray-400">({bookmarks.length})</span>
                  ) : null}
                </h2>
                {bookmarks.length > 0 && (() => {
                  const urgentCount = bookmarks.filter(
                    (b) => b.deadline_status === 'urgent'
                  ).length
                  return urgentCount > 0 ? (
                    <p className="mt-0.5 text-[10px] text-red-500">
                      {urgentCount} ilanın son başvuru tarihi yaklaşıyor
                    </p>
                  ) : null
                })()}
              </div>
              <button
                onClick={() => router.push('/listings')}
                className="rounded-full border border-[#1E3A5F]/20 px-3 py-1 text-[10px] font-medium text-[#1E3A5F] hover:bg-blue-50"
              >
                + İlan Keşfet
              </button>
            </div>

            {!bookmarks || bookmarks.length === 0 ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <p className="mb-1 text-sm font-medium text-gray-500">Henüz kaydettiğin ilan yok</p>
                <p className="mb-3 text-xs text-gray-400">
                  İlanlara göz at ve beğendiklerini kaydet
                </p>
                <button
                  onClick={() => router.push('/listings')}
                  className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-xs text-white hover:bg-[#15304f]"
                >
                  İlanlara Göz At
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleBookmarks.map((bookmark) => (
                  <BookmarkCard
                    key={bookmark.id}
                    listing={bookmark}
                    onRemove={() => handleRemove(bookmark.id)}
                  />
                ))}
                {!showAll && bookmarks.length > 5 ? (
                  <button
                    onClick={() => setShowAll(true)}
                    className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600"
                  >
                    {bookmarks.length - 5} ilan daha göster
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="campus-card rounded-2xl p-4">
            <div className="mb-4 flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold ${
                  profile ? getAvatarColor(profile.full_name) : 'bg-gray-100 text-gray-400'
                }`}
              >
                {profile ? getInitials(profile.full_name) : '??'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800">{profile?.full_name ?? '-'}</p>
                <p className="truncate text-[11px] text-gray-400">{profile?.iuc_email ?? '-'}</p>
              </div>
            </div>

            {profile ? (
              <>
                <div className="mb-3 space-y-2.5">
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-[11px] text-gray-500">Öğrenci No</span>
                    <span className="text-[11px] font-medium text-gray-800">
                      {profile.student_no ?? <span className="text-gray-300">Belirtilmedi</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-[11px] text-gray-500">Sınıf</span>
                    <span className="text-[11px] font-medium text-gray-800">
                      {profile.department_year
                        ? `${profile.department_year}. Sınıf`
                        : <span className="text-gray-300">Belirtilmedi</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-[11px] text-gray-500">LinkedIn</span>
                    {profile.linkedin_url ? (
                      <a
                        href={profile.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-[11px] font-medium text-[#1E3A5F] hover:underline"
                      >
                        Profili Gör
                      </a>
                    ) : (
                      <span className="text-[11px] text-gray-300">Belirtilmedi</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-[11px] text-gray-500">CV</span>
                    {profile.cv_url ? (
                      <a
                        href={profile.cv_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-medium text-[#1E3A5F] hover:underline"
                      >
                        Görüntüle
                      </a>
                    ) : (
                      <span className="text-[11px] text-gray-300">Yüklenmedi</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-[11px] text-gray-500">Durum</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                        profile.is_verified
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {profile.is_verified ? 'Doğrulandı' : 'Doğrulanmadı'}
                    </span>
                  </div>
                </div>

                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-gray-500">Profil tamamlanma</span>
                  <span className="font-medium text-[#1E3A5F]">%{profile.completion_percentage}</span>
                </div>
                <div className="mb-3 h-1.5 rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[#1E3A5F] transition-all"
                    style={{ width: `${profile.completion_percentage}%` }}
                  />
                </div>
              </>
            ) : null}

            <button
              onClick={() => setEditOpen(!editOpen)}
              className="mt-3 w-full rounded-lg border border-gray-200 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
            >
              {editOpen ? 'Kapat' : 'Profili Düzenle'}
            </button>
            {editOpen && profile ? (
              <ProfileEdit
                profile={profile}
                onSaved={() => {
                  mutateProfile()
                  setEditOpen(false)
                }}
              />
            ) : null}
          </div>

          <div className="campus-card rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-800">Bugün Yeni</h3>
              <button
                onClick={() => router.push('/listings?ordering=-created_at')}
                className="text-xs text-[#1E3A5F] hover:underline"
              >
                Tümü
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Bugün {stats?.new_listings_today ?? 0} yeni ilan eklendi.{' '}
              <button
                onClick={() => router.push('/listings')}
                className="text-[#1E3A5F] hover:underline"
              >
                Göz at
              </button>
            </p>
          </div>
        </div>
      </div>


    </div>
  )
}
