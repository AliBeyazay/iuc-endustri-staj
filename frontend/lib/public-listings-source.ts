import 'server-only'

import type { HomepageFeaturedListing, Listing } from '@/types'
import type { ListingsResponse } from '@/app/listings/types'
import { getBackendApiBaseUrl } from '@/lib/backend-url'
import {
  buildPublicSnapshotListingsResponse,
  getPublicSnapshotFeaturedListings,
  getPublicSnapshotListingById,
} from '@/lib/public-listings-snapshot'
import {
  PUBLIC_LISTINGS_REQUEST_TIMEOUT_MS,
  PUBLIC_LISTINGS_REVALIDATE_SECONDS,
} from '@/lib/public-listings-cache'

type DataSource = 'backend' | 'snapshot' | null

type ListingsLoadResult = {
  data: ListingsResponse | null
  source: DataSource
}

type ListingLoadResult = {
  data: Listing | null
  source: DataSource
  status: number
}

type FeaturedLoadResult = {
  data: HomepageFeaturedListing[]
  source: DataSource
}

const backendApiBaseUrl = getBackendApiBaseUrl()
const defaultHeaders = {
  Accept: 'application/json',
  'ngrok-skip-browser-warning': 'true',
}

async function fetchBackendJson<T>(pathname: string): Promise<T | null> {
  const response = await fetch(`${backendApiBaseUrl}${pathname}`, {
    headers: defaultHeaders,
    next: { revalidate: PUBLIC_LISTINGS_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(PUBLIC_LISTINGS_REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    return null
  }

  return (await response.json()) as T
}

export async function loadHomepageFeaturedListings(): Promise<FeaturedLoadResult> {
  try {
    const data = await fetchBackendJson<HomepageFeaturedListing[]>('/homepage/featured-listings/')
    if (data !== null) {
      return { data, source: 'backend' }
    }
  } catch {
    // Fall through to the static snapshot below.
  }

  return {
    data: await getPublicSnapshotFeaturedListings(),
    source: 'snapshot',
  }
}

export async function loadListingsResponse(requestUrl: URL): Promise<ListingsLoadResult> {
  const pathname = `/listings/${requestUrl.search}`

  try {
    const data = await fetchBackendJson<ListingsResponse>(pathname)
    if (data !== null) {
      return { data, source: 'backend' }
    }
  } catch {
    // Fall through to the static snapshot below.
  }

  return {
    data: await buildPublicSnapshotListingsResponse(requestUrl),
    source: 'snapshot',
  }
}

export async function loadListingById(id: string): Promise<ListingLoadResult> {
  try {
    const response = await fetch(`${backendApiBaseUrl}/listings/${id}/`, {
      headers: defaultHeaders,
      next: { revalidate: PUBLIC_LISTINGS_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(PUBLIC_LISTINGS_REQUEST_TIMEOUT_MS),
    })

    if (response.status === 404) {
      const snapshotListing = await getPublicSnapshotListingById(id)
      if (snapshotListing) {
        return { data: snapshotListing, source: 'snapshot', status: 200 }
      }

      return { data: null, source: 'backend', status: 404 }
    }

    if (response.ok) {
      return {
        data: (await response.json()) as Listing,
        source: 'backend',
        status: response.status,
      }
    }
  } catch {
    // Fall through to the static snapshot below.
  }

  return {
    data: await getPublicSnapshotListingById(id),
    source: 'snapshot',
    status: 200,
  }
}
