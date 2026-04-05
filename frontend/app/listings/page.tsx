import { getBackendApiBaseUrl } from '@/lib/backend-url'
import ListingsPageClient from './ListingsPageClient'
import { buildDefaultListingsApiQuery, buildDefaultListingsSWRKey } from './listings-query'
import type { ListingsResponse } from './types'

export const dynamic = 'force-dynamic'

const backendApiBaseUrl = getBackendApiBaseUrl()

async function getInitialListings(): Promise<ListingsResponse | null> {
  const queryString = buildDefaultListingsApiQuery()

  try {
    const response = await fetch(`${backendApiBaseUrl}/listings/?${queryString}`, {
      headers: {
        Accept: 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as ListingsResponse
  } catch {
    return null
  }
}

export default async function ListingsPage() {
  const initialData = await getInitialListings()

  return (
    <ListingsPageClient
      initialData={initialData}
      initialSWRKey={buildDefaultListingsSWRKey()}
    />
  )
}
