'use client'

import useSWR from 'swr'
import { fetchListingById } from '@/lib/api'
import ListingDetailClient from './ListingDetailClient'
import AuthedNavbar from '@/components/AuthedNavbar'

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#f9f9ff] dark:bg-[#0e1e33]">
      <AuthedNavbar activePath="/listings" />

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
            <section className="rounded-xl bg-white p-6 sm:p-8 space-y-4 dark:bg-[#1a2d45]">
              <div className="h-6 w-48 rounded-lg bg-[#132843]/10 campus-shimmer dark:bg-white/10" />
              <div className="h-4 w-full rounded-lg bg-[#132843]/6 campus-shimmer dark:bg-white/6" />
              <div className="h-4 w-full rounded-lg bg-[#132843]/6 campus-shimmer dark:bg-white/6" />
              <div className="h-4 w-5/6 rounded-lg bg-[#132843]/5 campus-shimmer dark:bg-white/5" />
              <div className="h-4 w-4/6 rounded-lg bg-[#132843]/4 campus-shimmer dark:bg-white/4" />
              <div className="h-4 w-full rounded-lg bg-[#132843]/6 campus-shimmer dark:bg-white/6" />
            </section>
          </div>

          {/* Right Column Skeleton */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-xl bg-[#132843] p-8 space-y-4">
              <div className="h-6 w-24 rounded-lg bg-white/15 campus-shimmer" />
              <div className="h-12 w-full rounded-lg bg-[#d8ad43]/20 campus-shimmer" />
              <div className="h-12 w-full rounded-lg bg-white/10 campus-shimmer" />
            </div>
            <div className="rounded-xl bg-[#f0f3ff] p-6 space-y-3 dark:bg-[#132843]/50">
              <div className="h-4 w-full rounded bg-[#132843]/8 campus-shimmer dark:bg-white/8" />
              <div className="h-4 w-full rounded bg-[#132843]/8 campus-shimmer dark:bg-white/8" />
              <div className="h-4 w-full rounded bg-[#132843]/8 campus-shimmer dark:bg-white/8" />
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
        <div className="mx-auto max-w-6xl rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center shadow-sm dark:border-rose-800/30 dark:bg-rose-900/20">
          <p className="text-lg font-semibold text-rose-800 dark:text-rose-300">İlan detayları yüklenemedi</p>
          <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">Lutfen daha sonra tekrar dene.</p>
        </div>
      </div>
    )
  }

  return <ListingDetailClient listing={data} />
}
