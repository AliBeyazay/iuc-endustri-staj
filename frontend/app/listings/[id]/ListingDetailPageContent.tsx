'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { fetchListingById } from '@/lib/api'
import ListingDetailClient from './ListingDetailClient'
import ProfileDropdown from '@/components/ProfileDropdown'
import ThemeToggle from '@/components/ThemeToggle'
import UniversityLogo from '@/components/UniversityLogo'

function DetailSkeleton() {
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
          <section className="campus-card animate-pulse rounded-[28px] p-5 sm:p-6">
            <div className="h-3 w-16 rounded bg-[#d8ad43]/20" />
            <div className="mt-4 flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-[#173156]/8" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-7 w-3/4 rounded bg-[#173156]/8" />
                <div className="h-4 w-1/2 rounded bg-[#173156]/6" />
                <div className="h-3 w-1/3 rounded bg-[#173156]/5" />
              </div>
            </div>
          </section>

          <section className="campus-card animate-pulse rounded-[28px] p-5 sm:p-6 space-y-3">
            <div className="h-3 w-20 rounded bg-[#d8ad43]/20" />
            <div className="h-3 w-full rounded bg-[#173156]/6" />
            <div className="h-3 w-full rounded bg-[#173156]/6" />
            <div className="h-3 w-5/6 rounded bg-[#173156]/6" />
            <div className="h-3 w-4/6 rounded bg-[#173156]/5" />
          </section>
        </div>

        <div className="space-y-4">
          <div className="campus-card animate-pulse rounded-[28px] p-5 space-y-3">
            <div className="h-10 w-full rounded-xl bg-[#d8ad43]/15" />
            <div className="h-3 w-2/3 rounded bg-[#173156]/6" />
            <div className="h-3 w-1/2 rounded bg-[#173156]/5" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ListingDetailPageContent({ id }: { id: string }) {
  const { data, error, isLoading } = useSWR(`listing-${id}`, () => fetchListingById(id))

  if (isLoading || !data) {
    return <DetailSkeleton />
  }

  if (error) {
    return (
      <div className="campus-shell min-h-screen px-4 py-8">
        <div className="mx-auto max-w-6xl rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-rose-800">İlan detayları yüklenemedi</p>
          <p className="mt-2 text-sm text-rose-700">Lutfen daha sonra tekrar dene.</p>
        </div>
      </div>
    )
  }

  return <ListingDetailClient listing={data} />
}
