import Link from 'next/link'
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, MapPin, Sparkles } from 'lucide-react'
import type { HomepageFeaturedListing } from '@/types'
import { PLATFORM_LABELS, getAvatarColor, getInitials } from '@/lib/helpers'

type FeaturedListingCardProps = {
  listing: HomepageFeaturedListing
}

const INTERNSHIP_LABELS: Record<string, string> = {
  zorunlu: 'Zorunlu',
  gonullu: 'Gönüllü',
  belirsiz: 'Belirsiz',
}

const FALLBACK_BANNERS = [
  'linear-gradient(135deg, rgba(76, 29, 149, 0.92), rgba(37, 99, 235, 0.88) 58%, rgba(14, 165, 233, 0.8))',
  'linear-gradient(135deg, rgba(4, 120, 87, 0.92), rgba(8, 145, 178, 0.85) 52%, rgba(14, 116, 144, 0.84))',
  'linear-gradient(135deg, rgba(180, 83, 9, 0.92), rgba(220, 38, 38, 0.84) 52%, rgba(249, 115, 22, 0.84))',
  'linear-gradient(135deg, rgba(30, 64, 175, 0.94), rgba(124, 58, 237, 0.84) 56%, rgba(217, 70, 239, 0.76))',
]

function getBannerBackground(name: string) {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash)
  }
  return FALLBACK_BANNERS[Math.abs(hash) % FALLBACK_BANNERS.length]
}

function formatFeaturedDeadline(deadline: string | null | undefined) {
  if (!deadline) return 'Belirtilmedi'
  return new Date(deadline).toLocaleDateString('tr-TR')
}

export default function FeaturedListingCard({ listing }: FeaturedListingCardProps) {
  const initials = getInitials(listing.company_name)
  const avatarColor = getAvatarColor(listing.company_name)
  const bannerImage = listing.homepage_featured_image_url
  const internshipLabel = INTERNSHIP_LABELS[listing.internship_type] ?? 'Belirsiz'
  const summary =
    listing.homepage_featured_summary?.trim() ||
    'Bu fırsatın detaylarını incelemek ve başvuru akışına geçmek için kartı aç.'
  const platformLabel = PLATFORM_LABELS[listing.source_platform] ?? 'Platform'

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="campus-card campus-card-hover group flex h-full flex-col overflow-hidden rounded-[28px] border"
    >
      <div className="relative h-56 overflow-hidden border-b border-white/10">
        {bannerImage ? (
          <img
            src={bannerImage}
            alt={`${listing.company_name} görseli`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: getBannerBackground(listing.company_name) }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),_transparent_26%)]" />
            <div className="absolute -right-14 top-6 h-40 w-40 rounded-full border border-white/20 bg-white/10 blur-2xl" />
            <div className="absolute left-8 top-10 h-24 w-24 rounded-[32px] border border-white/15 bg-white/10 backdrop-blur-sm" />
            <div className="absolute bottom-8 left-8 max-w-[70%]">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/70">
                {platformLabel}
              </p>
              <h3 className="campus-heading mt-3 text-3xl leading-none text-white">
                Öne Çıkan
              </h3>
              <p className="mt-3 text-sm font-medium text-white/82">
                {listing.company_name}
              </p>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#091728]/86 via-[#091728]/26 to-transparent" />
        <div className="absolute left-5 right-5 top-5 flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/16 bg-white/12 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Sparkles size={13} />
            Öne Çıkan
          </span>
          <span className="rounded-full border border-white/16 bg-[#d8ad43] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#10223b] shadow-[0_8px_22px_rgba(216,173,67,0.35)]">
            {platformLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start gap-4">
          {listing.company_logo_url ? (
            <img
              src={listing.company_logo_url}
              alt={listing.company_name}
              className="h-16 w-16 shrink-0 rounded-2xl border border-[#d8ad43]/20 bg-white/85 object-contain p-2"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#d8ad43]/20 text-base font-semibold ${avatarColor}`}>
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#173156]/62 dark:text-[#e7edf4]/65">
              {listing.company_name}
            </p>
            <h3 className="mt-1 line-clamp-2 text-3xl leading-[1.02] text-[#132843] dark:text-[#f8fbff]">
              {listing.title}
            </h3>
          </div>
        </div>

        <p className="mt-5 line-clamp-3 text-[15px] leading-7 text-[#173156]/72 dark:text-[#e7edf4]/72">
          {summary}
        </p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#173156]/8 bg-white/78 px-3 py-1.5 text-xs font-semibold text-[#173156]/78 dark:border-white/10 dark:bg-white/8 dark:text-[#e7edf4]/75">
            <BriefcaseBusiness size={14} />
            {internshipLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#173156]/8 bg-white/78 px-3 py-1.5 text-xs font-semibold text-[#173156]/78 dark:border-white/10 dark:bg-white/8 dark:text-[#e7edf4]/75">
            <CalendarDays size={14} />
            {formatFeaturedDeadline(listing.application_deadline)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#173156]/8 bg-white/78 px-3 py-1.5 text-xs font-semibold text-[#173156]/78 dark:border-white/10 dark:bg-white/8 dark:text-[#e7edf4]/75">
            <MapPin size={14} />
            {listing.location}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-[#d8ad43]/14 pt-5">
          <span className="text-sm font-semibold text-[#173156] dark:text-[#e7edf4]">
            Detaylara Git
          </span>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8ad43]/26 bg-[#d8ad43]/12 text-[#173156] transition-transform duration-200 group-hover:translate-x-1 dark:text-[#f0cf7a]">
            <ArrowUpRight size={18} />
          </span>
        </div>
      </div>
    </Link>
  )
}
