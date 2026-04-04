'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { Listing } from '@/types'
import {
  FOCUS_AREA_COLORS,
  FOCUS_AREA_LABELS,
  PLATFORM_LABELS,
  formatDateTurkish,
  formatListingDescription,
  getAvatarColor,
  getDeadlineDisplay,
  getInitials,
  timeAgoTurkish,
} from '@/lib/helpers'
import { createReview, fetchSimilarListings, SimilarListing } from '@/lib/api'
import { useBookmarks, useRecentlyViewed, useReviews } from '@/hooks'
import ProfileDropdown from '@/components/ProfileDropdown'
import UniversityLogo from '@/components/UniversityLogo'

const INTERNSHIP_LABEL: Record<string, string> = {
  zorunlu: 'Zorunlu',
  gonullu: 'Gönüllü',
  belirsiz: 'Belirsiz',
}

const ORIGIN_LABEL: Record<string, string> = {
  yerli: 'Türk Firması',
  yabanci: 'Yabancı Firma',
  belirsiz: 'Belirsiz',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  )
}

function ReviewStars({
  value,
  onChange,
  interactive = false,
}: {
  value: number
  onChange?: (value: number) => void
  interactive?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = index + 1
        const active = starValue <= value

        if (!interactive) {
          return (
            <span
              key={starValue}
              className={active ? 'text-[#d8ad43]' : 'text-[#d4d8e3]'}
            >
              ★
            </span>
          )
        }

        return (
          <button
            key={starValue}
            type="button"
            onClick={() => onChange?.(starValue)}
            className={`text-xl transition-all duration-150 hover:scale-125 ${
              active ? 'text-[#d8ad43] drop-shadow-[0_0_4px_rgba(216,173,67,0.3)]' : 'text-[#d4d8e3] hover:text-[#d8ad43]/50'
            }`}
            aria-label={`${starValue} puan ver`}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}

export default function ListingDetailClient({ listing }: { listing: Listing }) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { bookmarks, toggle } = useBookmarks()
  const { addView } = useRecentlyViewed()
  const { reviews, isLoading: reviewsLoading, mutate: mutateReviews } = useReviews(listing.id)

  useEffect(() => {
    addView({ id: listing.id, title: listing.title, company_name: listing.company_name })
  }, [listing.id, listing.title, listing.company_name, addView])
  const [expandDesc, setExpandDesc] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showQrCode, setShowQrCode] = useState(false)
  const [currentUrl, setCurrentUrl] = useState('')
  const [detailLogoError, setDetailLogoError] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [internshipYear, setInternshipYear] = useState(new Date().getFullYear())
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')

  const { data: similar } = useSWR<SimilarListing[]>(
    `similar-${listing.id}`,
    () => fetchSimilarListings(listing.id)
  )

  const deadline = getDeadlineDisplay(listing)
  const initials = getInitials(listing.company_name)
  const avatarColor = getAvatarColor(listing.company_name)
  const isBookmarked = bookmarks.has(listing.id)
  const descriptionBlocks = formatListingDescription(listing.description)
  const descriptionBlocksWithoutIntro = descriptionBlocks.slice(1)
  const visibleBlocks = expandDesc
    ? descriptionBlocksWithoutIntro
    : descriptionBlocksWithoutIntro.slice(0, 4)
  const targetUrl = listing.application_url || listing.source_url
  const averageRating = useMemo(() => {
    if (!reviews.length) return 0
    const total = reviews.reduce((sum, item) => sum + item.rating, 0)
    return total / reviews.length
  }, [reviews])
  const isAuthenticated = status === 'authenticated'
  const shareUrl = currentUrl || targetUrl
  const qrCodeUrl = useMemo(() => {
    const encodedUrl = encodeURIComponent(shareUrl)
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodedUrl}`
  }, [shareUrl])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href)
    }
  }, [])

  const deadlineBadgeClass =
    deadline.color === 'red'
      ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      : deadline.color === 'orange'
        ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
        : deadline.color === 'blue'
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : 'bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-slate-300'

  async function handleShare() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReviewError('')
    setReviewSuccess('')

    if (!isAuthenticated) {
      setReviewError('Değerlendirme paylaşmak için önce giriş yapmalısın.')
      return
    }

    if (rating < 1 || rating > 5) {
      setReviewError('Lütfen 1 ile 5 arasında bir puan seç.')
      return
    }

    if (!comment.trim()) {
      setReviewError('Lütfen kısa bir öğrenci görüşü yaz.')
      return
    }

    try {
      setReviewSubmitting(true)
      await createReview({
        listing: listing.id,
        rating,
        comment: comment.trim(),
        internship_year: internshipYear,
        is_anonymous: isAnonymous,
      })
      setReviewSuccess('Değerlendirmen başarıyla eklendi.')
      setComment('')
      setRating(0)
      setInternshipYear(new Date().getFullYear())
      setIsAnonymous(true)
      await mutateReviews()
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.non_field_errors?.[0] ||
        error?.response?.data?.comment?.[0] ||
        'Değerlendirme eklenemedi. Daha önce yorum yaptıysan aynı ilan için ikinci yorum bırakılamaz.'
      setReviewError(message)
    } finally {
      setReviewSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f9f9ff] dark:bg-[#0e1e33]">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-[#1A233A] shadow-md" style={{ borderBottom: '2px solid transparent', borderImage: 'linear-gradient(to right, #B8860B, #F3E5AB, #B8860B) 1' }}>
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
                    nav.href === '/listings'
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

      <main className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        {/* ── Hero Section ── */}
        <section className="relative mb-10 overflow-hidden rounded-xl bg-[#132843] text-white shadow-xl">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_#785a00,_transparent)]" />
          <div className="relative z-10 flex flex-col gap-8 p-6 sm:p-8 md:flex-row md:items-start md:justify-between md:p-12">
            <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:text-left">
              {/* Company Logo */}
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-white p-4 shadow-lg">
                {listing.company_logo_url && !detailLogoError ? (
                  <img
                    src={listing.company_logo_url}
                    alt={listing.company_name}
                    referrerPolicy="no-referrer"
                    onError={() => setDetailLogoError(true)}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center rounded-lg text-lg font-bold ${avatarColor}`}>
                    {initials}
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <h1 className="campus-heading max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                  {listing.title}
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-4 text-sm md:justify-start">
                  <span className="inline-flex items-center gap-1.5 text-[#d4e3ff]/80">
                    <svg className="h-4 w-4 text-[#fdce61]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="font-medium">{listing.location}</span>
                  </span>
                  {deadline.label && (
                    <span className="inline-flex items-center gap-1.5 text-[#d4e3ff]/80">
                      <svg className="h-4 w-4 text-[#fdce61]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      <span className="font-medium">{deadline.label}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-[#d4e3ff]/80">
                    <svg className="h-4 w-4 text-[#fdce61]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <span className="font-medium">{INTERNSHIP_LABEL[listing.internship_type]} / Staj</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 md:items-end">
              <span className="text-xs font-bold uppercase tracking-widest text-[#fdce61]">
                {PLATFORM_LABELS[listing.source_platform]}
              </span>
              <span className="rounded-full bg-[#785a00] px-4 py-1.5 text-xs font-bold tracking-wider text-white">
                AKTİF İLAN
              </span>
            </div>
          </div>
        </section>

        {/* ── Main Content Grid ── */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          {/* ── Left Column ── */}
          <div className="space-y-8 lg:col-span-8">
            {/* Description */}
            <section className="rounded-xl bg-white p-6 sm:p-8 dark:bg-[#1a2d45]">
              <h2 className="campus-heading mb-6 flex items-center gap-3 text-xl font-bold text-[#132843] dark:text-[#e7edf4]">
                <span className="block h-6 w-1.5 bg-[#785a00]" />
                İLAN AÇIKLAMASI
              </h2>
              <div className="space-y-4">
                {visibleBlocks.map((block, index) => {
                  const isSectionTitle =
                    block.length < 50 && !/[.!?]/.test(block) && block.split(' ').length <= 6
                  const isNumberedItem = /^\d+\s*[.)-]/.test(block)

                  if (isSectionTitle) {
                    return (
                      <h3 key={`${block}-${index}`} className="text-sm font-bold uppercase tracking-wider text-[#132843] dark:text-[#e7edf4]">
                        {block}
                      </h3>
                    )
                  }

                  if (isNumberedItem) {
                    return (
                      <p key={`${block}-${index}`} className="border-l-2 border-[#d8ad43]/25 pl-3 text-sm leading-relaxed text-[#44474d] dark:text-[#e7edf4]/70">
                        {block}
                      </p>
                    )
                  }

                  return (
                    <p key={`${block}-${index}`} className="text-sm leading-relaxed text-[#44474d] dark:text-[#e7edf4]/70">
                      {block}
                    </p>
                  )
                })}
              </div>
              {descriptionBlocksWithoutIntro.length > 4 && (
                <button
                  onClick={() => setExpandDesc((prev) => !prev)}
                  className="mt-4 text-xs font-semibold text-[#785a00] transition-colors hover:text-[#d8ad43]"
                >
                  {expandDesc ? '↑ Daha az göster' : 'Devamını gör ↓'}
                </button>
              )}
            </section>

            {/* Requirements */}
            {listing.requirements && (
              <section className="rounded-xl bg-white p-6 sm:p-8 dark:bg-[#1a2d45]">
                <h2 className="campus-heading mb-6 flex items-center gap-3 text-xl font-bold text-[#132843] dark:text-[#e7edf4]">
                  <span className="block h-6 w-1.5 bg-[#785a00]" />
                  ARANAN NİTELİKLER
                </h2>
                <ul className="space-y-2">
                  {listing.requirements
                    .split(/\n|-/)
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((item, index) => (
                      <li key={`${item}-${index}`} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#44474d] dark:text-[#e7edf4]/70">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#785a00]" />
                        <span>{item}</span>
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {/* Reviews */}
            <section className="rounded-xl border border-[#c4c6ce]/15 bg-[#f0f3ff] p-6 sm:p-8 dark:border-white/10 dark:bg-[#132843]/50">
              <h2 className="campus-heading mb-8 flex items-center gap-3 text-xl font-bold text-[#132843] dark:text-[#e7edf4]">
                <span className="block h-6 w-1.5 bg-[#785a00]" />
                ÖĞRENCİ DEĞERLENDİRMELERİ
              </h2>

              {/* Rating Summary */}
              <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="flex flex-col items-center justify-center rounded-xl bg-white p-6 text-center dark:bg-[#1a2d45]">
                  <span className="text-4xl font-bold text-[#132843] dark:text-[#e7edf4]">{averageRating.toFixed(1)}</span>
                  <div className="my-2">
                    <ReviewStars value={Math.round(averageRating)} />
                  </div>
                  <span className="text-xs font-medium text-[#44474d] dark:text-[#e7edf4]/60">{reviews.length} Değerlendirme</span>
                </div>
                <div className="flex flex-col justify-center space-y-2 md:col-span-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.filter((r) => r.rating === star).length
                    const pct = reviews.length ? (count / reviews.length) * 100 : 0
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <span className="w-14 text-xs font-bold text-[#132843] dark:text-[#e7edf4]">{star} Yıldız</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white dark:bg-white/10">
                          <div className="h-full rounded-full bg-[#785a00] transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Review Form */}
              <form
                onSubmit={handleReviewSubmit}
                className="mb-8 rounded-xl border border-[#c4c6ce]/20 bg-white/50 p-6 backdrop-blur dark:bg-[#1a2d45]/50"
              >
                <h3 className="mb-4 text-sm font-bold text-[#132843] dark:text-[#e7edf4]">Bir Değerlendirme Bırakın</h3>
                <div className="mb-4">
                  <ReviewStars value={rating} onChange={setRating} interactive />
                </div>

                <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="internship-year" className="mb-1 block text-xs font-medium text-[#44474d] dark:text-[#e7edf4]/60">
                      Staj Yılı
                    </label>
                    <input
                      id="internship-year"
                      type="number"
                      value={internshipYear}
                      onChange={(event) => setInternshipYear(Number(event.target.value))}
                      min={2000}
                      max={2100}
                      className="w-full rounded-lg border-0 bg-white p-3 text-sm text-[#132843] ring-1 ring-inset ring-[#c4c6ce]/30 focus:ring-2 focus:ring-[#785a00]/50 dark:bg-[#0e1e33] dark:text-[#e7edf4] dark:ring-white/10"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-[#44474d] dark:text-[#e7edf4]/60">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(event) => setIsAnonymous(event.target.checked)}
                        className="h-4 w-4 rounded border-[#c4c6ce] text-[#132843] focus:ring-[#785a00]/30"
                      />
                      Anonim paylaş
                    </label>
                  </div>
                </div>

                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={4}
                  placeholder="Deneyiminizi paylaşın..."
                  className="mb-4 w-full rounded-lg border-0 bg-white p-4 text-sm text-[#132843] ring-1 ring-inset ring-[#c4c6ce]/30 placeholder:text-[#44474d]/50 focus:ring-2 focus:ring-[#785a00]/50 dark:bg-[#0e1e33] dark:text-[#e7edf4] dark:ring-white/10 dark:placeholder:text-[#e7edf4]/30"
                />

                {!isAuthenticated && (
                  <p className="mb-4 rounded-lg border border-[#fdce61]/30 bg-[#fff8e8] px-4 py-3 text-xs text-[#44474d] dark:border-[#fdce61]/20 dark:bg-[#fdce61]/10 dark:text-[#e7edf4]/70">
                    Değerlendirme bırakmak için önce giriş yapmalısın.
                  </p>
                )}
                {reviewError && (
                  <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/30 dark:bg-red-900/20 dark:text-red-300">
                    {reviewError}
                  </p>
                )}
                {reviewSuccess && (
                  <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-900/20 dark:text-emerald-300">
                    {reviewSuccess}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="rounded-lg bg-[#132843] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1E3A5F] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#d8ad43] dark:text-[#10223b] dark:hover:bg-[#e4c05c]"
                >
                  {reviewSubmitting ? 'Gönderiliyor...' : 'Gönder'}
                </button>

                {isAuthenticated && session?.user && (
                  <p className="mt-3 text-xs text-[#44474d]/60 dark:text-[#e7edf4]/40">
                    Giriş yapan kullanıcı olarak yorumun hesabına bağlı kaydedilir.
                  </p>
                )}
              </form>

              {/* Individual Reviews */}
              <div className="space-y-4">
                {reviewsLoading ? (
                  <div className="rounded-xl bg-white px-6 py-4 text-sm text-[#44474d] dark:bg-[#1a2d45] dark:text-[#e7edf4]/60">
                    Değerlendirmeler yükleniyor...
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="rounded-xl bg-white px-6 py-4 text-sm text-[#44474d] dark:bg-[#1a2d45] dark:text-[#e7edf4]/60">
                    Henüz öğrenci değerlendirmesi yok. İlk yorumu sen paylaşabilirsin.
                  </div>
                ) : (
                  reviews.map((review) => (
                    <article
                      key={review.id}
                      className="rounded-xl border-l-4 border-[#785a00]/30 bg-white p-6 dark:bg-[#1a2d45]"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-[#132843] dark:text-[#e7edf4]">
                            {review.is_anonymous ? 'Anonim Öğrenci' : 'Öğrenci'}
                          </h4>
                          <span className="text-[10px] font-medium text-[#44474d] dark:text-[#e7edf4]/60">
                            Staj Yılı: {review.internship_year}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#44474d] dark:text-[#e7edf4]/50">
                          {formatDateTurkish(review.created_at)}
                        </span>
                      </div>
                      <div className="mb-2">
                        <ReviewStars value={review.rating} />
                      </div>
                      <p className="text-xs italic leading-relaxed text-[#44474d] dark:text-[#e7edf4]/70">
                        &ldquo;{review.comment}&rdquo;
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="lg:col-span-4">
            <aside className="sticky top-28 space-y-6">
              {/* Apply Card */}
              <div className="relative overflow-hidden rounded-xl bg-[#132843] p-8 text-white shadow-2xl shadow-[#132843]/20">
                <div className="absolute -right-4 -top-4 text-[120px] leading-none opacity-10">★</div>
                <h3 className="relative z-10 mb-6 text-xl font-bold">BAŞVURU</h3>
                <div className="relative z-10 space-y-4">
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#d8ad43] py-3.5 font-bold text-[#132843] transition-all hover:brightness-110"
                  >
                    Kaynağa Git
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                  <button
                    onClick={() => toggle(listing.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 py-3.5 font-medium transition-all hover:bg-white/20"
                  >
                    {isBookmarked ? 'Kaydı Kaldır' : 'Kaydet'}
                    <svg className="h-4 w-4" fill={isBookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  </button>

                  {/* QR Code */}
                  <div className="border-t border-white/10 pt-6">
                    <div className="flex flex-col items-center">
                      {showQrCode && (
                        <div className="mb-4 rounded-lg bg-white p-3">
                          <img
                            src={qrCodeUrl}
                            alt="İlan paylaşım QR kodu"
                            loading="lazy"
                            className="h-32 w-32"
                          />
                        </div>
                      )}
                      <button
                        onClick={() => setShowQrCode((prev) => !prev)}
                        className="flex items-center gap-2 text-sm font-medium text-[#fdce61]"
                      >
                        {showQrCode ? 'QR Kodunu Kapat' : 'QR Kodunu Göster'}
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Meta Info Card */}
              <div className="space-y-4 rounded-xl bg-[#f0f3ff] p-6 dark:bg-[#132843]/50">
                <div className="flex items-center justify-between border-b border-[#c4c6ce]/10 py-2 dark:border-white/10">
                  <span className="text-xs font-medium text-[#44474d] dark:text-[#e7edf4]/60">Yayınlanma Tarihi</span>
                  <span className="text-xs font-bold text-[#132843] dark:text-[#e7edf4]">{formatDateTurkish(listing.created_at)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#c4c6ce]/10 py-2 dark:border-white/10">
                  <span className="text-xs font-medium text-[#44474d] dark:text-[#e7edf4]/60">Kategori</span>
                  <span className="text-xs font-bold text-[#132843] dark:text-[#e7edf4]">{FOCUS_AREA_LABELS[listing.em_focus_area]}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#c4c6ce]/10 py-2 dark:border-white/10">
                  <span className="text-xs font-medium text-[#44474d] dark:text-[#e7edf4]/60">Firma Kökeni</span>
                  <span className="text-xs font-bold text-[#132843] dark:text-[#e7edf4]">{ORIGIN_LABEL[listing.company_origin]}</span>
                </div>
                <button
                  onClick={handleShare}
                  className="flex w-full items-center justify-center gap-2 py-2 text-xs font-bold text-[#785a00]"
                >
                  {copied ? 'Kopyalandı!' : 'Paylaş'}
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                </button>
              </div>
            </aside>
          </div>
        </div>

        {/* ── Similar Listings ── */}
        {similar && similar.length > 0 && (
          <section className="mt-16">
            <h2 className="campus-heading mb-8 flex items-center gap-3 text-2xl font-bold text-[#132843] dark:text-[#e7edf4]">
              <span className="block h-8 w-2 bg-[#785a00]" />
              BENZER İLANLAR
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {similar.map((item) => {
                const reasons = item.match_reasons || []
                return (
                  <Link
                    key={item.id}
                    href={`/listings/${item.id}`}
                    className="group rounded-xl border border-[#c4c6ce]/10 bg-white p-6 transition-all hover:shadow-xl dark:border-white/10 dark:bg-[#1a2d45] dark:hover:shadow-none"
                  >
                    <div className="mb-6 flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#c4c6ce]/5 bg-[#f0f3ff] p-2 dark:border-white/5 dark:bg-[#132843]/50">
                        <span className="text-xs font-bold text-[#132843] dark:text-[#e7edf4]">{getInitials(item.company_name)}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-bold text-[#132843] dark:text-[#e7edf4]">{item.title}</h4>
                        <p className="text-[10px] font-medium text-[#44474d] dark:text-[#e7edf4]/60">{item.company_name}</p>
                      </div>
                    </div>
                    {reasons.length > 0 && (
                      <div className="mb-6 flex flex-wrap gap-2">
                        {reasons.includes('company') && (
                          <span className="rounded-full bg-[#e7eeff] px-2 py-1 text-[10px] font-bold text-[#132843] dark:bg-[#132843] dark:text-[#e7edf4]">AYNI ŞİRKET</span>
                        )}
                        {reasons.includes('focus_area') && (
                          <span className="rounded-full bg-[#e7eeff] px-2 py-1 text-[10px] font-bold text-[#132843] dark:bg-[#132843] dark:text-[#e7edf4]">AYNI ALAN</span>
                        )}
                        {reasons.includes('location') && (
                          <span className="rounded-full bg-[#e7eeff] px-2 py-1 text-[10px] font-bold text-[#132843] dark:bg-[#132843] dark:text-[#e7edf4]">AYNI KONUM</span>
                        )}
                        {reasons.includes('title') && (
                          <span className="rounded-full bg-[#e7eeff] px-2 py-1 text-[10px] font-bold text-[#132843] dark:bg-[#132843] dark:text-[#e7edf4]">BENZER BAŞLIK</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-[#c4c6ce]/10 pt-4 dark:border-white/10">
                      <span className="text-[10px] font-medium text-[#44474d] dark:text-[#e7edf4]/50">
                        {timeAgoTurkish(listing.created_at)}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#785a00] group-hover:text-[#d8ad43]">
                        İncele
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {/* ── Mobile Bottom Bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d8ad43]/20 bg-[#132843]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur lg:hidden">
        <a
          href={targetUrl}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#d8ad43] py-3 text-sm font-bold text-[#132843]"
        >
          Başvur
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>
      </div>
    </div>
  )
}
