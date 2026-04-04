'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Bookmark, BookmarkCheck, Clock, MapPin, Share2, Sparkles } from 'lucide-react'
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
  zorunlu: 'bg-[#dfe9f6] text-[#23446f] dark:bg-[#23446f]/30 dark:text-[#a8c4e6]',
  gonullu: 'bg-[#e6efe3] text-[#355b2a] dark:bg-[#355b2a]/30 dark:text-[#a8d4a0]',
  belirsiz: 'bg-[#ece6d8] text-[#6e6140] dark:bg-[#6e6140]/30 dark:text-[#d4c8a8]',
}

const INTERNSHIP_LABEL: Record<string, string> = {
  zorunlu: 'Zorunlu',
  gonullu: 'G\u00f6n\u00fcll\u00fc',
  belirsiz: 'Belirsiz',
}

const ORIGIN_BADGE: Record<string, string> = {
  yerli: 'bg-[#f0dfb3] text-[#8b660f] dark:bg-[#8b660f]/30 dark:text-[#f0cf7a]',
  yabanci: 'bg-[#e7e1f2] text-[#5b487b] dark:bg-[#5b487b]/30 dark:text-[#c8b8e0]',
  belirsiz: 'bg-[#ece6d8] text-[#6e6140] dark:bg-[#6e6140]/30 dark:text-[#d4c8a8]',
}

const ORIGIN_LABEL: Record<string, string> = {
  yerli: 'Yerli',
  yabanci: 'Yabanc\u0131',
  belirsiz: 'Belirsiz',
}

export default function ListingCard({ listing, isBookmarked, onBookmark }: Props) {
  const router = useRouter()
  const [logoError, setLogoError] = useState(false)
  const deadline = getDeadlineDisplay(listing)
  const initials = getInitials(listing.company_name)
  const avatarColor = getAvatarColor(listing.company_name)

  const deadlineClass =
    deadline.color === 'red' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
    deadline.color === 'orange' ? 'bg-[#f7ead2] text-[#a46c09] dark:bg-[#a46c09]/20 dark:text-[#f0cf7a]' :
    deadline.color === 'blue' ? 'bg-[#e1ebf7] text-[#23446f] dark:bg-[#23446f]/30 dark:text-[#a8c4e6]' :
    'text-[#173156]/55 dark:text-[#e7edf4]/40'

  return (
    <article
      onClick={() => router.push(`/listings/${listing.id}`)}
      className="campus-card campus-card-hover group cursor-pointer overflow-hidden rounded-[26px] border p-4"
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
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#173156]/10 bg-white/70 text-[#173156]/60 transition-all duration-200 hover:scale-110 hover:text-[#173156] hover:border-[#d8ad43]/30 dark:border-white/10 dark:bg-white/8 dark:text-white/50 dark:hover:text-white dark:hover:border-[#d8ad43]/30"
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
        {listing.company_logo_url && !logoError ? (
          <img
            src={listing.company_logo_url}
            alt={listing.company_name}
            width={46}
            height={46}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setLogoError(true)}
            className="h-12 w-12 min-w-[48px] rounded-2xl border border-[#d8ad43]/20 bg-white/80 object-contain p-1.5 ring-2 ring-[#d8ad43]/10 group-hover:ring-[#d8ad43]/25 transition-all duration-200 dark:bg-white/10"
          />
        ) : (
          <div className={`flex h-12 w-12 min-w-[48px] items-center justify-center rounded-2xl border border-[#d8ad43]/20 ring-2 ring-[#d8ad43]/10 group-hover:ring-[#d8ad43]/25 transition-all duration-200 text-[11px] font-semibold ${avatarColor}`}>
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[1.05rem] font-semibold leading-[1.18] text-[#132843] group-hover:text-[#1E3A5F] transition-colors duration-200 dark:text-[#e7edf4] dark:group-hover:text-[#d8ad43]">
            {listing.title}
          </p>
          <p className="mt-1 truncate text-[12px] font-medium text-[#173156]/72 dark:text-[#e7edf4]/65">
            {listing.company_name}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#173156]/58 dark:text-[#e7edf4]/50">
            <span className={`rounded-full px-2.5 py-[3px] text-[10px] font-semibold ${FOCUS_AREA_COLORS[listing.em_focus_area]}`}>
              {FOCUS_AREA_LABELS[listing.em_focus_area]}
            </span>
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
          <span className="campus-pill-gold rounded-full px-2.5 py-[3px] text-[10px] font-semibold">
            {'Yetenek Program\u0131'}
          </span>
        )}
        <span className={`rounded-full px-2.5 py-[3px] text-[10px] font-semibold ${ORIGIN_BADGE[listing.company_origin]}`}>
          {ORIGIN_LABEL[listing.company_origin]}
        </span>
        <span className={`rounded-full px-2.5 py-[3px] text-[10px] font-semibold ${INTERNSHIP_BADGE[listing.internship_type]}`}>
          {INTERNSHIP_LABEL[listing.internship_type]}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-[#d8ad43]/12 pt-3">
        {deadline.label ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${deadlineClass}`}>
            <Clock size={11} />
            {deadline.label}
          </span>
        ) : <span />}

        <div className="flex gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigator.clipboard.writeText(`${window.location.origin}/listings/${listing.id}`)
            }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] text-[#173156]/55 transition-colors hover:bg-[#173156]/5 hover:text-[#173156] dark:text-[#e7edf4]/50 dark:hover:bg-white/8 dark:hover:text-[#e7edf4]"
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
            <ArrowUpRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </article>
  )
}
