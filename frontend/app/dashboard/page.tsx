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
import { getAvatarColor, getDeadlineDisplay, getInitials } from '@/lib/helpers'
import MobileBottomNav from '@/components/MobileBottomNav'
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

  return (
    <div
      onClick={() => router.push(`/listings/${listing.id}`)}
      className={`cursor-pointer rounded-lg bg-gray-50 p-2.5 transition-colors hover:bg-gray-100 sm:flex sm:items-center sm:gap-2 ${
        deadline.color === 'red' ? 'border-l-2 border-red-400' : ''
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-100 text-[9px] font-medium ${avatarColor}`}
      >
        {initials}
      </div>
      <div className="mt-2 min-w-0 flex-1 sm:mt-0">
        <p className="truncate text-xs font-medium text-gray-800">{listing.title}</p>
        <p className="mt-0.5 text-[10px] text-gray-400">
          {listing.company_name}
          {deadline.label ? (
            <span
              className={`ml-1.5 font-medium ${
                deadline.color === 'red' ? 'text-red-600' : 'text-gray-400'
              }`}
            >
              - {deadline.label}
            </span>
          ) : null}
        </p>
      </div>
      <div
        className="mt-2 flex items-center gap-1 sm:mt-0 sm:shrink-0"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={() => router.push(`/listings/${listing.id}`)}
          className="rounded border border-gray-200 px-1.5 py-1 text-[10px] text-gray-400 hover:text-[#1E3A5F]"
        >
          Gör
        </button>
        {confirm ? (
          <div className="flex gap-1">
            <button
              onClick={() => {
                onRemove()
                setConfirm(false)
              }}
              className="rounded border border-red-200 px-1.5 py-1 text-[10px] text-red-500"
            >
              Evet
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="rounded border border-gray-200 px-1.5 py-1 text-[10px] text-gray-400"
            >
              Hayır
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="px-1 text-sm text-gray-300 hover:text-gray-400"
          >
            x
          </button>
        )}
      </div>
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
  const visibleBookmarks = showAll ? bookmarks ?? [] : (bookmarks ?? []).slice(0, 5)
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
    <div className="campus-shell min-h-screen pb-24 lg:pb-0">
      <nav className="campus-nav sticky top-0 z-10 flex items-center justify-between gap-3 overflow-hidden px-4 py-3 sm:px-5">
        <Link href="/listings" className="relative z-10 flex min-w-0 items-center gap-3">
          <UniversityLogo className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" />
          <div className="min-w-0">
            <span className="campus-brand block text-lg leading-none sm:text-2xl">
              {'\u0130stanbul \u00dcniversitesi Cerrahpa\u015fa'}
            </span>
            <p className="hidden text-[10px] uppercase tracking-[0.28em] text-[#f4e3b3]/80 sm:block">
              {'End\u00fcstri M\u00fchendisli\u011fi Staj Platformu'}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/listings')}
            className="hidden rounded-full border border-[#d8ad43]/35 bg-white/8 px-3 py-2 text-xs font-semibold text-[#f7ecd0] transition-colors hover:bg-white/14 sm:inline-flex"
          >
            İlanlar
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex h-10 min-w-10 items-center justify-center rounded-full border border-[#d8ad43]/35 bg-[#f1d27e] px-2 text-[10px] font-bold text-[#10223b] shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
            aria-label="Profil"
          >
            {profile ? getInitials(profile.full_name) : '??'}
          </button>
        </div>
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
              <h2 className="text-sm font-medium text-gray-800">
                Kaydedilen İlanlar
                {bookmarks ? (
                  <span className="ml-1.5 text-xs text-gray-400">({bookmarks.length})</span>
                ) : null}
              </h2>
              <button
                onClick={() => router.push('/listings')}
                className="text-xs text-[#1E3A5F] hover:underline"
              >
                Tümünü gör
              </button>
            </div>

            {!bookmarks || bookmarks.length === 0 ? (
              <div className="py-8 text-center">
                <p className="mb-2 text-sm text-gray-400">Henüz kaydettiğin ilan yok</p>
                <button
                  onClick={() => router.push('/listings')}
                  className="rounded-lg border border-[#1E3A5F] px-3 py-1.5 text-xs text-[#1E3A5F] hover:bg-blue-50"
                >
                  İlanlara Göz At
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
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
            <div className="mb-3 flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-medium ${
                  profile ? getAvatarColor(profile.full_name) : 'bg-gray-100 text-gray-400'
                }`}
              >
                {profile ? getInitials(profile.full_name) : '??'}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{profile?.full_name ?? '-'}</p>
                <p className="text-xs text-gray-400">{profile?.iuc_email ?? '-'}</p>
              </div>
            </div>

            {profile ? (
              <>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-gray-500">Profil tamamlanma</span>
                  <span className="font-medium text-[#1E3A5F]">%{profile.completion_percentage}</span>
                </div>
                <div className="mb-2 h-1.5 rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[#1E3A5F] transition-all"
                    style={{ width: `${profile.completion_percentage}%` }}
                  />
                </div>
                {profile.missing_fields.length > 0 ? (
                  <div className="space-y-1">
                    {profile.missing_fields.map((field) =>
                      missingHints[field] ? (
                        <button
                          key={field}
                          onClick={() => setEditOpen(true)}
                          className="block text-[10px] text-blue-600 hover:underline"
                        >
                          {missingHints[field]}
                        </button>
                      ) : null
                    )}
                  </div>
                ) : null}
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

      <MobileBottomNav current="profile" />
    </div>
  )
}
