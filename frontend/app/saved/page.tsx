'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { fetchBookmarks, removeBookmark } from '@/lib/api'
import { BookmarkedListing } from '@/types'
import { getAvatarColor, getDeadlineDisplay, getInitials, timeAgoTurkish } from '@/lib/helpers'
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

export default function SavedPage() {
  const router = useRouter()
  const { status } = useSession()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [router, status])

  const {
    data: bookmarksData,
    mutate: mutateBookmarks,
  } = useSWR<BookmarkedListing[]>(
    status === 'authenticated' ? 'bookmarks' : null,
    fetchBookmarks
  )

  const bookmarks = bookmarksData ?? []

  const sortedBookmarks = [...bookmarks].sort((a, b) => {
    const urgencyOrder: Record<string, number> = { urgent: 0, upcoming: 1, normal: 2, unknown: 3, expired: 4 }
    const aU = urgencyOrder[a.deadline_status] ?? 3
    const bU = urgencyOrder[b.deadline_status] ?? 3
    if (aU !== bU) return aU - bU
    return new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime()
  })

  async function handleRemove(id: string) {
    await removeBookmark(id)
    mutateBookmarks()
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-sm text-gray-500">
        Yükleniyor...
      </div>
    )
  }

  if (status === 'unauthenticated') return null

  return (
    <div className="campus-shell min-h-screen">
      <nav className="campus-nav sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <Link href="/listings" className="relative z-10 flex min-w-0 items-center gap-3">
          <UniversityLogo className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" />
          <div className="min-w-0">
            <span className="campus-brand block text-[11px] leading-tight xs:text-xs sm:text-2xl sm:leading-none whitespace-nowrap">
              İstanbul Üniversitesi Cerrahpaşa
            </span>
            <p className="text-[7px] uppercase tracking-[0.12em] text-[#f4e3b3]/80 xs:text-[8px] sm:text-[10px] sm:tracking-[0.28em] whitespace-nowrap">
              Endüstri Mühendisliği Staj Platformu
            </p>
          </div>
        </Link>
        <ProfileDropdown />
      </nav>

      <div className="mx-auto max-w-2xl px-3 py-6 sm:px-4">
        <div className="campus-card rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-base font-medium text-gray-900">
                Kaydedilen İlanlar
                {bookmarks.length > 0 ? (
                  <span className="ml-1.5 text-xs text-gray-400">({bookmarks.length})</span>
                ) : null}
              </h1>
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
              {sortedBookmarks.map((bookmark) => (
                <BookmarkCard
                  key={bookmark.id}
                  listing={bookmark}
                  onRemove={() => handleRemove(bookmark.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
