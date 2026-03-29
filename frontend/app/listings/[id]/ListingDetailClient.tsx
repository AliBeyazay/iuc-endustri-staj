'use client'

import { FormEvent, useMemo, useState } from 'react'
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
import { createReview, fetchSimilarListings } from '@/lib/api'
import { useBookmarks, useReviews } from '@/hooks'
import ProfileDropdown from '@/components/ProfileDropdown'
import ThemeToggle from '@/components/ThemeToggle'
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
            className={`text-xl transition-transform hover:scale-110 ${
              active ? 'text-[#d8ad43]' : 'text-[#d4d8e3]'
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
  const { reviews, isLoading: reviewsLoading, mutate: mutateReviews } = useReviews(listing.id)
  const [expandDesc, setExpandDesc] = useState(false)
  const [copied, setCopied] = useState(false)
  const [detailLogoError, setDetailLogoError] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [internshipYear, setInternshipYear] = useState(new Date().getFullYear())
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')

  const { data: similar } = useSWR(
    `similar-${listing.id}`,
    () => fetchSimilarListings(listing.em_focus_area, listing.id)
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

  const deadlineBadgeClass =
    deadline.color === 'red'
      ? 'bg-red-50 text-red-700'
      : deadline.color === 'orange'
        ? 'bg-orange-50 text-orange-700'
        : deadline.color === 'blue'
          ? 'bg-blue-50 text-blue-700'
          : 'bg-slate-100 text-slate-600'

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.href)
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
    <div className="campus-shell min-h-screen pb-24 lg:pb-0">
      <nav className="campus-nav sticky top-0 z-10 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/listings" className="flex min-w-0 items-center gap-3">
            <UniversityLogo className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" />
            <div className="min-w-0">
              <span className="campus-brand block text-[11px] leading-tight xs:text-xs sm:text-2xl sm:leading-none whitespace-nowrap">
                {'İstanbul Üniversitesi Cerrahpaşa'}
              </span>
              <p className="text-[7px] uppercase tracking-[0.12em] text-[#f4e3b3]/80 xs:text-[8px] sm:text-[10px] sm:tracking-[0.28em] whitespace-nowrap">
                {'Endüstri Mühendisliği Staj Platformu'}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ProfileDropdown />
          </div>
        </div>
      </nav>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-3 py-4 sm:px-4 sm:py-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5">
        <div className="space-y-4">
          <section className="campus-card rounded-[28px] p-5 sm:p-6">
            <p className="campus-heading text-[11px] text-[#8f670b] dark:text-[#f0cf7a]">İlan Özeti</p>

            <div className="mt-4 flex items-start gap-4">
              {listing.company_logo_url && !detailLogoError ? (
                <img
                  src={listing.company_logo_url}
                  alt={listing.company_name}
                  referrerPolicy="no-referrer"
                  onError={() => setDetailLogoError(true)}
                  className="h-14 w-14 rounded-2xl border border-[#d8ad43]/20 bg-white/80 object-contain p-1.5 dark:bg-white/10"
                />
              ) : (
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${avatarColor}`}>
                  {initials}
                </div>
              )}

              <div className="min-w-0">
                <h1 className="campus-heading text-2xl leading-tight text-[#132843] sm:text-3xl dark:text-[#e7edf4]">
                  {listing.title}
                </h1>
                <p className="mt-2 text-sm text-[#173156]/70 dark:text-[#e7edf4]/60">
                </p>
                <p className="mt-2 text-xs text-[#173156]/55 dark:text-[#e7edf4]/45"> yayınlandı
                </p>
              </div>
            </div>

            {false && <div className="mt-4 flex flex-wrap gap-2">
              {listing.is_talent_program && (
                <Badge label="Yetenek Programı" className="bg-purple-100 text-purple-800" />
              )}
              <Badge
                label={FOCUS_AREA_LABELS[listing.em_focus_area]}
                className={FOCUS_AREA_COLORS[listing.em_focus_area]}
              />
              <Badge
                label={ORIGIN_LABEL[listing.company_origin]}
                className="bg-slate-100 text-slate-700"
              />
              <Badge
                label={INTERNSHIP_LABEL[listing.internship_type]}
                className="bg-blue-100 text-blue-800"
              />
              <Badge
                label={PLATFORM_LABELS[listing.source_platform]}
                className="bg-gray-100 text-gray-600"
              />
              {deadline.label && <Badge label={deadline.label} className={deadlineBadgeClass} />}
            </div>}
          </section>

          <section className="campus-card rounded-[28px] p-5 sm:p-6">
            <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-[#8f670b]/80 dark:text-[#f0cf7a]/70">
              İlan Açıklaması
            </h2>

            <div className="mt-4 space-y-4">
              {visibleBlocks.map((block, index) => {
                const isSectionTitle =
                  block.length < 50 && !/[.!?]/.test(block) && block.split(' ').length <= 6

                const isNumberedItem = /^\d+\s*[.)-]/.test(block)

                if (isSectionTitle) {
                  return (
                    <h3 key={`${block}-${index}`} className="text-sm font-semibold text-[#8f670b] pt-1 dark:text-[#f0cf7a]">
                      {block}
                    </h3>
                  )
                }

                if (isNumberedItem) {
                  return (
                    <p key={`${block}-${index}`} className="text-sm leading-7 text-[#173156]/82 pl-3 border-l-2 border-[#d8ad43]/25 dark:text-[#e7edf4]/70">
                      {block}
                    </p>
                  )
                }

                return (
                  <p key={`${block}-${index}`} className="text-sm leading-7 text-[#173156]/82 dark:text-[#e7edf4]/70">
                    {block}
                  </p>
                )
              })}
            </div>

            {descriptionBlocksWithoutIntro.length > 4 && (
              <button
                onClick={() => setExpandDesc((prev) => !prev)}
                className="mt-4 text-xs font-semibold text-[#1E3A5F] hover:underline"
              >
                {expandDesc ? 'Daha az göster' : 'Devamını gör'}
              </button>
            )}
          </section>

          <section className="campus-card rounded-[28px] p-5 sm:p-6">
            <div className="flex flex-col gap-3 border-b border-dashed border-[#d8ad43]/28 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-[#8f670b]/80 dark:text-[#f0cf7a]/70">
                  Öğrenci Değerlendirmeleri
                </h2>
                <p className="mt-2 text-sm text-[#173156]/68 dark:text-[#e7edf4]/55">
                  Bu ilan hakkında deneyim, süreç ve görüş paylaşabilirsin.
                </p>
              </div>

              <div className="rounded-2xl border border-[#d8ad43]/16 bg-white/60 px-4 py-3 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <ReviewStars value={Math.round(averageRating)} />
                  <div>
                    <p className="text-lg font-semibold text-[#132843] dark:text-[#e7edf4]">
                    </p>
                    <p className="text-xs text-[#173156]/58 dark:text-[#e7edf4]/45">{reviews.length} değerlendirme</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-3">
                {reviewsLoading ? (
                  <div className="rounded-2xl border border-[#d8ad43]/14 bg-white/45 px-4 py-4 text-sm text-[#173156]/60 dark:bg-white/5 dark:text-[#e7edf4]/50">
                    Değerlendirmeler yükleniyor...
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="rounded-2xl border border-[#d8ad43]/14 bg-white/45 px-4 py-4 text-sm text-[#173156]/60 dark:bg-white/5 dark:text-[#e7edf4]/50">
                    Henüz öğrenci değerlendirmesi yok. İlk yorumu sen paylaşabilirsin.
                  </div>
                ) : (
                  reviews.map((review) => (
                    <article
                      key={review.id}
                      className="rounded-2xl border border-[#d8ad43]/14 bg-white/55 px-4 py-4 dark:bg-white/5"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <ReviewStars value={review.rating} />
                            <span className="text-sm font-semibold text-[#132843] dark:text-[#e7edf4]">
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-[#173156]/58 dark:text-[#e7edf4]/45">
                            {review.is_anonymous ? 'Anonim öğrenci' : 'Öğrenci'} - {review.internship_year}
                          </p>
                        </div>
                        <span className="text-xs text-[#173156]/52 dark:text-[#e7edf4]/40">
                          {formatDateTurkish(review.created_at)}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-7 text-[#173156]/82 dark:text-[#e7edf4]/70">
                      </p>
                    </article>
                  ))
                )}
              </div>

              <form
                onSubmit={handleReviewSubmit}
                className="rounded-[24px] border border-[#d8ad43]/16 bg-white/65 p-4 dark:bg-white/5"
              >
                <h3 className="text-sm font-semibold text-[#132843] dark:text-[#e7edf4]">Görüşünü Paylaş</h3>
                <p className="mt-1 text-xs leading-6 text-[#173156]/62 dark:text-[#e7edf4]/50">
                  Puan verip kısa bir yorum bırak. Bu alan diğer öğrenciler için yol gösterici olacak.
                </p>

                <div className="mt-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8f670b]/80 dark:text-[#f0cf7a]/70">
                    Puanın
                  </label>
                  <div className="mt-2">
                    <ReviewStars value={rating} onChange={setRating} interactive />
                  </div>
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="internship-year"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8f670b]/80 dark:text-[#f0cf7a]/70"
                  >
                    Staj Yılı
                  </label>
                  <input
                    id="internship-year"
                    type="number"
                    value={internshipYear}
                    onChange={(event) => setInternshipYear(Number(event.target.value))}
                    min={2000}
                    max={2100}
                    className="mt-2 w-full rounded-2xl border border-[#d8ad43]/18 bg-white px-4 py-3 text-sm text-[#132843] outline-none transition-colors focus:border-[#d8ad43]/40 dark:bg-[#0e1e33] dark:text-[#e7edf4]"
                  />
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="review-comment"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8f670b]/80 dark:text-[#f0cf7a]/70"
                  >
                    Yorumun
                  </label>
                  <textarea
                    id="review-comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    rows={5}
                    placeholder="Başvuru süreci, mülakat deneyimi veya ilanın faydası hakkında kısa bir görüş yaz."
                    className="mt-2 w-full rounded-2xl border border-[#d8ad43]/18 bg-white px-4 py-3 text-sm leading-7 text-[#132843] outline-none transition-colors placeholder:text-[#173156]/38 focus:border-[#d8ad43]/40 dark:bg-[#0e1e33] dark:text-[#e7edf4] dark:placeholder:text-[#e7edf4]/30"
                  />
                </div>

                <label className="mt-4 flex items-center gap-2 text-sm text-[#173156]/70 dark:text-[#e7edf4]/60">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(event) => setIsAnonymous(event.target.checked)}
                    className="h-4 w-4 rounded border-[#d8ad43]/30 text-[#1E3A5F] focus:ring-[#d8ad43]/30"
                  />
                  Adım görünmeden anonim paylaş
                </label>

                {!isAuthenticated && (
                  <p className="mt-4 rounded-2xl border border-[#d8ad43]/16 bg-[#fff8e8] px-4 py-3 text-xs leading-6 text-[#173156]/70 dark:bg-[#d8ad43]/10 dark:text-[#e7edf4]/60">
                    Değerlendirme bırakmak için önce giriş yapman gerekiyor.
                  </p>
                )}

                {reviewError && (
                  <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {reviewError}
                  </p>
                )}

                {reviewSuccess && (
                  <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {reviewSuccess}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="mt-5 w-full rounded-2xl bg-[#1E3A5F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#173156] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#d8ad43] dark:text-[#10223b] dark:hover:bg-[#e4c05c]"
                >
                  {reviewSubmitting ? 'Gönderiliyor...' : 'Değerlendirmeyi Gönder'}
                </button>

                {isAuthenticated && session?.user && (
                  <p className="mt-3 text-xs text-[#173156]/50 dark:text-[#e7edf4]/40">
                    Giriş yapan kullanıcı olarak yorumun hesabına bağlı kaydedilir.
                  </p>
                )}
              </form>
            </div>
          </section>

          {listing.requirements && (
            <section className="campus-card rounded-[28px] p-5 sm:p-6">
              <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-[#8f670b]/80 dark:text-[#f0cf7a]/70">
                Aranan Nitelikler
              </h2>
              <ul className="mt-4 space-y-2">
                {listing.requirements
                  .split(/\n|-/)
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .map((item, index) => (
                    <li key={`${item}-${index}`} className="flex items-start gap-2 text-sm text-[#173156]/82 dark:text-[#e7edf4]/70">
                      <span className="mt-0.5 text-[#8f670b] dark:text-[#f0cf7a]">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {similar && similar.length > 0 && (
            <section className="campus-card rounded-[28px] p-5 sm:p-6">
              <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-[#8f670b]/80 dark:text-[#f0cf7a]/70">
                Benzer İlanlar
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {similar.map((item) => (
                  <Link
                    key={item.id}
                    href={`/listings/${item.id}`}
                    className="rounded-2xl border border-[#d8ad43]/16 bg-white/55 px-4 py-4 transition-colors hover:border-[#d8ad43]/35 hover:bg-white/80 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <p className="text-sm font-semibold text-[#132843] dark:text-[#e7edf4]">{item.title}</p>
                    <p className="mt-1 text-xs text-[#173156]/62 dark:text-[#e7edf4]/50">{item.company_name}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="campus-card rounded-[28px] p-5">
            <p className="campus-heading text-[11px] text-[#8f670b] dark:text-[#f0cf7a]">Başvuru</p>

            <div className="mt-4 space-y-3">
              <a
                href={targetUrl}
                target="_blank"
                rel="noreferrer"
                className="campus-button-primary flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold"
              >
                Kaynağa Git
              </a>

              <button
                onClick={() => toggle(listing.id)}
                className="campus-button-secondary w-full rounded-2xl px-4 py-3 text-sm font-semibold"
              >
                {isBookmarked ? 'Kaydı Kaldır' : 'Kaydet'}
              </button>

              <button
                onClick={handleShare}
                className="w-full rounded-2xl border border-[#173156]/12 bg-white/55 px-4 py-3 text-sm font-semibold text-[#173156] transition-colors hover:bg-white/80 dark:border-[#e7edf4]/12 dark:bg-white/5 dark:text-[#e7edf4] dark:hover:bg-white/10"
              >
                {copied ? 'Bağlantı Kopyalandı' : 'Bağlantıyı Kopyala'}
              </button>
            </div>
          </section>

        </aside>
      </div>


    </div>
  )
}
