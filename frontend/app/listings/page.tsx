import { loadListingsResponse } from '@/lib/public-listings-source'
import ListingsPageClient from './ListingsPageClient'
import { buildDefaultListingsApiQuery, buildDefaultListingsSWRKey } from './listings-query'
import { Suspense } from 'react'
import type { PaginatedResponse, Listing } from '@/types'

export const revalidate = 300

async function getInitialListings(): Promise<PaginatedResponse<Listing> | null> {
  const requestUrl = new URL(`https://fallback.local/api/listings?${buildDefaultListingsApiQuery()}`)
  const { data } = await loadListingsResponse(requestUrl)
  return data
}

export default async function ListingsPage() {
  const initialData = await getInitialListings()

  return (
    <Suspense fallback={<div className="flex justify-center p-12 text-gray-400">Yükleniyor...</div>}>
      <ListingsPageClient
        initialData={initialData}
        initialSWRKey={buildDefaultListingsSWRKey()}
      />
    </Suspense>
  )
}
