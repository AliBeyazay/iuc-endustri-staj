'use client'

import useSWR from 'swr'
import { fetchListingById } from '@/lib/api'
import ListingDetailClient from './ListingDetailClient'

export default function ListingDetailPageContent({ id }: { id: string }) {
  const { data, error, isLoading } = useSWR(`listing-${id}`, () => fetchListingById(id))

  if (isLoading || !data) {
    return (
      <div className="campus-shell min-h-screen px-4 py-8">
        <div className="mx-auto max-w-6xl rounded-[28px] border border-[#d8ad43]/16 bg-white/72 p-8 text-center shadow-[0_24px_60px_rgba(18,40,67,0.08)]">
          <p className="text-sm text-[#173156]/68">İlan detayları yükleniyor...</p>
        </div>
      </div>
    )
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
