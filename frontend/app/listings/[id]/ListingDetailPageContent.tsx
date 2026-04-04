'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { fetchListingById } from '@/lib/api'
import ListingDetailClient from './ListingDetailClient'
import ProfileDropdown from '@/components/ProfileDropdown'
import UniversityLogo from '@/components/UniversityLogo'

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#f9f9ff]">
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
        {/* Hero Skeleton */}
        <section className="relative mb-10 overflow-hidden rounded-xl bg-[#132843] p-6 sm:p-8 md:p-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="h-24 w-24 shrink-0 rounded-xl bg-white/10 campus-shimmer" />
            <div className="flex-1 space-y-4">
              <div className="h-10 w-3/4 rounded-lg bg-white/10 campus-shimmer" />
              <div className="h-5 w-1/2 rounded-lg bg-white/8 campus-shimmer" />
              <div className="h-4 w-1/3 rounded-lg bg-white/6 campus-shimmer" />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Left Column Skeleton */}
          <div className="space-y-8 lg:col-span-8">
            <section className="rounded-xl bg-white p-6 sm:p-8 space-y-4">
              <div className="h-6 w-48 rounded-lg bg-[#132843]/10 campus-shimmer" />
              <div className="h-4 w-full rounded-lg bg-[#132843]/6 campus-shimmer" />
              <div className="h-4 w-full rounded-lg bg-[#132843]/6 campus-shimmer" />
              <div className="h-4 w-5/6 rounded-lg bg-[#132843]/5 campus-shimmer" />
              <div className="h-4 w-4/6 rounded-lg bg-[#132843]/4 campus-shimmer" />
              <div className="h-4 w-full rounded-lg bg-[#132843]/6 campus-shimmer" />
            </section>
          </div>

          {/* Right Column Skeleton */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-xl bg-[#132843] p-8 space-y-4">
              <div className="h-6 w-24 rounded-lg bg-white/15 campus-shimmer" />
              <div className="h-12 w-full rounded-lg bg-[#d8ad43]/20 campus-shimmer" />
              <div className="h-12 w-full rounded-lg bg-white/10 campus-shimmer" />
            </div>
            <div className="rounded-xl bg-[#f0f3ff] p-6 space-y-3">
              <div className="h-4 w-full rounded bg-[#132843]/8 campus-shimmer" />
              <div className="h-4 w-full rounded bg-[#132843]/8 campus-shimmer" />
              <div className="h-4 w-full rounded bg-[#132843]/8 campus-shimmer" />
            </div>
          </div>
        </div>
      </main>
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
