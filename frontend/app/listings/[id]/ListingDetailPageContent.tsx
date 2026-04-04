'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { fetchListingById } from '@/lib/api'
import ListingDetailClient from './ListingDetailClient'
import ProfileDropdown from '@/components/ProfileDropdown'
import UniversityLogo from '@/components/UniversityLogo'

function DetailSkeleton() {
  return (
    <div className="campus-shell min-h-screen pb-24 lg:pb-0">
      <nav className="sticky top-0 z-10 bg-[#1A233A] shadow-md" style={{ borderBottom: '2px solid transparent', borderImage: 'linear-gradient(to right, #B8860B, #F3E5AB, #B8860B) 1' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-0 sm:px-6" style={{ height: '64px' }}>
          <Link href="/listings" className="flex items-center gap-4">
            <UniversityLogo className="h-10 w-10 shrink-0 rounded border border-[#D4AF37] p-0.5" />
            <div className="hidden sm:block">
              <span className="text-sm font-semibold uppercase tracking-wide text-[#D4AF37]">
                İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA
              </span>
              <p className="text-xs tracking-wider text-gray-300">
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

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-3 py-4 sm:px-4 sm:py-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5">
        <div className="space-y-4">
          <section className="rounded-[28px] border border-[#d8ad43]/20 bg-[linear-gradient(115deg,#0f2744_0%,#12335b_58%,#0f2744_100%)] p-5 sm:p-6">
            <div className="h-3 w-16 rounded-lg bg-[#d8ad43]/20 campus-shimmer" />
            <div className="mt-4 flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl bg-white/10 campus-shimmer" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-8 w-3/4 rounded-lg bg-white/10 campus-shimmer" />
                <div className="h-4 w-1/2 rounded-lg bg-white/8 campus-shimmer" />
                <div className="h-3 w-1/3 rounded-lg bg-white/6 campus-shimmer" />
              </div>
            </div>
          </section>

          <section className="campus-card rounded-[28px] p-5 sm:p-6 space-y-3">
            <div className="h-3 w-20 rounded-lg bg-[#d8ad43]/20 campus-shimmer" />
            <div className="h-3 w-full rounded-lg bg-[#173156]/6 campus-shimmer" />
            <div className="h-3 w-full rounded-lg bg-[#173156]/6 campus-shimmer" />
            <div className="h-3 w-5/6 rounded-lg bg-[#173156]/5 campus-shimmer" />
            <div className="h-3 w-4/6 rounded-lg bg-[#173156]/4 campus-shimmer" />
            <div className="h-3 w-full rounded-lg bg-[#173156]/6 campus-shimmer" />
            <div className="h-3 w-3/4 rounded-lg bg-[#173156]/5 campus-shimmer" />
          </section>
        </div>

        <div className="space-y-4">
          <div className="campus-card rounded-[28px] p-5 space-y-3">
            <div className="h-12 w-full rounded-2xl bg-[#d8ad43]/12 campus-shimmer" />
            <div className="h-12 w-full rounded-2xl bg-[#173156]/6 campus-shimmer" />
            <div className="h-12 w-full rounded-2xl bg-[#173156]/5 campus-shimmer" />
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
