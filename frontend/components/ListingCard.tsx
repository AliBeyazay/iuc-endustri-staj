'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowUpRight, Bookmark, BookmarkCheck, MapPin, Share2, Sparkles } from 'lucide-react'
import { Listing } from '@/types'
import {
  FOCUS_AREA_LABELS, FOCUS_AREA_COLORS, PLATFORM_LABELS,
  getInitials, getAvatarColor, timeAgoTurkish, getDeadlineDisplay,
} from '@/lib/helpers'

interface Props {
  listing: Listing
  isBookmarked: boolean
  onBookmark: (id: string) => void
}

const INTERNSHIP_BADGE: Record<string, string> = {
  zorunlu: 'bg-[#dfe9f6] text-[#23446f]',
  gonullu: 'bg-[#e6efe3] text-[#355b2a]',
  belirsiz: 'bg-[#ece6d8] text-[#6e6140]',
}

const INTERNSHIP_LABEL: Record<string, string> = {
  zorunlu: 'Zorunlu',
  gonullu: 'G\u00f6n\u00fcll\u00fc',
  belirsiz: 'Belirsiz',
}

const ORIGIN_BADGE: Record<string, string> = {
  yerli: 'bg-[#f0dfb3] text-[#8b660f]',
  yabanci: 'bg-[#e7e1f2] text-[#5b487b]',
  belirsiz: 'bg-[#ece6d8] text-[#6e6140]',
}

const ORIGIN_LABEL: Record<string, string> = {
  yerli: 'Yerli',
  yabanci: 'Yabanc\u0131',
  belirsiz: 'Belirsiz',
}

export default function ListingCard({ listing, isBookmarked, onBookmark }: Props) {
  const router = useRouter()
  const deadline = getDeadlineDisplay(listing)
  const initials = getInitials(listing.company_name)
  const avatarColor = getAvatarColor(listing.company_name)

  const deadlineClass =
    deadline.color === 'red' ? 'bg-red-50 text-red-700' :
    deadline.color === 'orange' ? 'bg-[#f7ead2] text-[#a46c09]' :
    deadline.color === 'blue' ? 'bg-[#e1ebf7] text-[#23446f]' :
    'text-[#173156]/55'

  return (
    <article
      onClick={() => router.push(`/listings/${listing.id}`)}
      className="campus-card group cursor-pointer overflow-hidden rounded-[26px] border p-4 transition-all duration-200 hover:-translate-y-1 hover:border-[#d8ad43]/45 hover:shadow-[0_28px_60px_rgba(10,21,35,0.16)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="campus-pill inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold">
          <Sparkles size={12} />
          {PLATFORM_LABELS[listing.source_platform]}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onBookmark(listing.id)
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#173156]/10 bg-white/70 text-[#173156]/60 transition-colors hover:text-[#173156]"
          aria-label={isBookmarked ? 'Kayd\u0131 kald\u0131r' : 'Kaydet'}
        >
          {isBookmarked ? (
            <BookmarkCheck size={16} className="text-[#c89a2d]" />
          ) : (
            <Bookmark size={16} />
          )}
        </button>
      </div>

      <div className="mb-4 flex items-start gap-3">
        {listing.company_logo_url ? (
          <Image
            src={listing.company_logo_url}
            alt={listing.company_name}
            width={46}
            height={46}
            className="rounded-2xl border border-[#d8ad43]/20 bg-white/80 object-contain p-1.5"
          />
        ) : (
          <div className={`flex h-12 w-12 min-w-[48px] items-center justify-center rounded-2xl border border-[#d8ad43]/20 text-[11px] font-semibold ${avatarColor}`}>
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="campus-heading line-clamp-2 text-[1.05rem] leading-[1.15] text-[#132843]">
            {listing.title}
          </p>
          <p className="mt-1 truncate text-[12px] font-medium text-[#173156]/72">
            {listing.company_name}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#173156]/58">
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} />
              {listing.location}
            </span>
            <span>{timeAgoTurkish(listing.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {listing.is_talent_program && (
          <span className="campus-pill-gold rounded-full px-2.5 py-1 text-[9px] font-semibold">
            {'Yetenek Program\u0131'}
          </span>
        )}
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${FOCUS_AREA_COLORS[listing.em_focus_area]}`}>
          {FOCUS_AREA_LABELS[listing.em_focus_area]}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${ORIGIN_BADGE[listing.company_origin]}`}>
          {ORIGIN_LABEL[listing.company_origin]}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${INTERNSHIP_BADGE[listing.internship_type]}`}>
          {INTERNSHIP_LABEL[listing.internship_type]}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-[#d8ad43]/12 pt-3">
        {deadline.label ? (
          <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${deadlineClass}`}>
            {deadline.label}
          </span>
        ) : <span />}

        <div className="flex gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigator.clipboard.writeText(`${window.location.origin}/listings/${listing.id}`)
            }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] text-[#173156]/55 transition-colors hover:bg-[#173156]/5 hover:text-[#173156]"
          >
            <Share2 size={12} />
            {'Payla\u015f'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/listings/${listing.id}`)
            }}
            className="campus-button-primary inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[10px] font-semibold"
          >
            {listing.is_talent_program ? 'Programa Bak' : 'Detay\u0131 G\u00f6r'}
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>
    </article>
  )
}
