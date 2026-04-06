import type { MetadataRoute } from 'next'
import { getBackendApiBaseUrl } from '@/lib/backend-url'

type ListingSitemapItem = {
  id: string
  created_at?: string | null
}

type PaginatedListingResponse = {
  results: ListingSitemapItem[]
  next: string | null
}

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? `https://${process.env.VERCEL_URL ?? 'iuc-endustri-staj.vercel.app'}`)
  .replace(/\/$/, '')
const backendApiBaseUrl = getBackendApiBaseUrl()
const REQUEST_TIMEOUT_MS = 8000
const MAX_SITEMAP_PAGES = 25

export const dynamic = 'force-dynamic'

async function fetchAllActiveListings(): Promise<ListingSitemapItem[]> {
  const allItems: ListingSitemapItem[] = []
  let page = 1
  let hasNext = true

  while (hasNext && page <= MAX_SITEMAP_PAGES) {
    const response = await fetch(`${backendApiBaseUrl}/listings/?page=${page}&ordering=-created_at`, {
      headers: {
        Accept: 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      break
    }

    const data = (await response.json()) as PaginatedListingResponse
    allItems.push(...(data.results ?? []))
    hasNext = Boolean(data.next)
    page += 1
  }

  return allItems
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseEntries: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/listings`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
  ]

  try {
    const listings = await fetchAllActiveListings()
    const listingEntries: MetadataRoute.Sitemap = listings.map((listing) => ({
      url: `${siteUrl}/listings/${listing.id}`,
      lastModified: listing.created_at ? new Date(listing.created_at) : new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    }))

    return [...baseEntries, ...listingEntries]
  } catch {
    return baseEntries
  }
}
