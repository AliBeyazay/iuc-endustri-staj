import 'server-only'

import { cache } from 'react'
import { promises as fs } from 'fs'
import path from 'path'
import type { HomepageFeaturedListing, Listing } from '@/types'
import type { ListingsResponse, RawListing } from '@/app/listings/types'

const SNAPSHOT_PATH = path.join(process.cwd(), 'lib', 'generated', 'public-listings-snapshot.json')
const DEFAULT_PAGE_SIZE = 20
const SEARCHABLE_FIELDS: Array<keyof Listing> = ['title', 'company_name', 'description', 'location']

type SnapshotListing = Listing & {
  bookmark_count?: number
  average_rating?: number
}

type PublicListingsSnapshot = {
  generated_at: string
  count: number
  listings: SnapshotListing[]
  featured_listings: HomepageFeaturedListing[]
}

const readPublicListingsSnapshot = cache(async (): Promise<PublicListingsSnapshot | null> => {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, 'utf-8')
    return JSON.parse(raw) as PublicListingsSnapshot
  } catch {
    return null
  }
})

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim()
}

function parsePositiveInt(value: string | null) {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function matchesDurationBucket(listing: SnapshotListing, durationBucket: string) {
  const duration = listing.duration_weeks
  if (duration == null) return false

  switch (durationBucket) {
    case '4_weeks':
      return duration <= 4
    case '8_weeks':
      return duration > 4 && duration <= 8
    case '12_plus_weeks':
      return duration >= 12
    default:
      return false
  }
}

function toTimestamp(value?: string | null) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function compareNullableNumbers(left: number | null, right: number | null, direction: 'asc' | 'desc') {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  return direction === 'asc' ? left - right : right - left
}

function sortSnapshotListings(listings: SnapshotListing[], ordering: string) {
  const orderings = ordering
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (!orderings.length) {
    return listings.sort((left, right) => {
      return compareNullableNumbers(toTimestamp(left.created_at), toTimestamp(right.created_at), 'desc')
    })
  }

  const collator = new Intl.Collator('tr', { sensitivity: 'base' })

  return listings.sort((left, right) => {
    for (const item of orderings) {
      const direction = item.startsWith('-') ? 'desc' : 'asc'
      const field = item.replace(/^-/, '')

      let comparison = 0
      switch (field) {
        case 'created_at':
          comparison = compareNullableNumbers(
            toTimestamp(left.created_at),
            toTimestamp(right.created_at),
            direction,
          )
          break
        case 'application_deadline':
          comparison = compareNullableNumbers(
            toTimestamp(left.application_deadline),
            toTimestamp(right.application_deadline),
            direction,
          )
          break
        case 'company_name':
          comparison = collator.compare(left.company_name, right.company_name)
          if (direction === 'desc') comparison *= -1
          break
        case 'bookmark_count':
          comparison = compareNullableNumbers(
            left.bookmark_count ?? 0,
            right.bookmark_count ?? 0,
            direction,
          )
          break
        case 'average_rating':
          comparison = compareNullableNumbers(
            left.average_rating ?? 0,
            right.average_rating ?? 0,
            direction,
          )
          break
        case 'em_focus_confidence':
          comparison = compareNullableNumbers(
            left.em_focus_confidence ?? 0,
            right.em_focus_confidence ?? 0,
            direction,
          )
          break
        default:
          comparison = compareNullableNumbers(
            toTimestamp(left.created_at),
            toTimestamp(right.created_at),
            'desc',
          )
          break
      }

      if (comparison !== 0) {
        return comparison
      }
    }

    return compareNullableNumbers(toTimestamp(left.created_at), toTimestamp(right.created_at), 'desc')
  })
}

function buildPageLink(requestUrl: URL, page: number) {
  const url = new URL(requestUrl.toString())
  url.searchParams.set('page', String(page))
  return `${url.pathname}?${url.searchParams.toString()}`
}

function toRawListing(listing: SnapshotListing): RawListing {
  return listing
}

export async function getPublicSnapshotFeaturedListings() {
  const snapshot = await readPublicListingsSnapshot()
  if (!snapshot) {
    return []
  }

  if (snapshot.featured_listings.length > 0) {
    return snapshot.featured_listings
  }

  return sortSnapshotListings([...snapshot.listings], '-created_at')
    .slice(0, 3)
    .map((listing) => ({
      id: listing.id,
      title: listing.title,
      company_name: listing.company_name,
      company_logo_url: listing.company_logo_url,
      source_platform: listing.source_platform,
      internship_type: listing.internship_type,
      location: listing.location,
      application_deadline: listing.application_deadline,
      is_talent_program: listing.is_talent_program,
      homepage_featured_image_url: null,
      homepage_featured_summary: listing.description.slice(0, 180).trim() || null,
    }))
}

export async function getPublicSnapshotListingById(id: string) {
  const snapshot = await readPublicListingsSnapshot()
  return snapshot?.listings.find((listing) => listing.id === id) ?? null
}

export async function buildPublicSnapshotListingsResponse(requestUrl: URL): Promise<ListingsResponse | null> {
  const snapshot = await readPublicListingsSnapshot()
  if (!snapshot) {
    return null
  }

  const { searchParams } = requestUrl
  const search = normalizeSearchValue(searchParams.get('search') ?? '')
  const ordering = searchParams.get('ordering') ?? '-created_at'
  const page = parsePositiveInt(searchParams.get('page')) ?? 1
  const limit = parsePositiveInt(searchParams.get('limit'))
  const emFocusAreas = new Set(searchParams.getAll('em_focus_area'))
  const internshipTypes = new Set(searchParams.getAll('internship_type'))
  const companyOrigins = new Set(searchParams.getAll('company_origin'))
  const sourcePlatforms = new Set(searchParams.getAll('source_platform'))
  const deadlineStatuses = new Set(searchParams.getAll('deadline_status'))
  const durationBuckets = new Set(searchParams.getAll('duration_bucket'))
  const talentOnly = searchParams.get('is_talent_program') === 'true'

  let listings = snapshot.listings.filter((listing) => {
    if (search) {
      const haystack = SEARCHABLE_FIELDS
        .map((field) => normalizeSearchValue(String(listing[field] ?? '')))
        .join(' ')
      if (!haystack.includes(search)) {
        return false
      }
    }

    if (emFocusAreas.size > 0 && !emFocusAreas.has(listing.em_focus_area)) return false
    if (internshipTypes.size > 0 && !internshipTypes.has(listing.internship_type)) return false
    if (companyOrigins.size > 0 && !companyOrigins.has(listing.company_origin)) return false
    if (sourcePlatforms.size > 0 && !sourcePlatforms.has(listing.source_platform)) return false
    if (deadlineStatuses.size > 0 && !deadlineStatuses.has(listing.deadline_status)) return false
    if (talentOnly && !listing.is_talent_program) return false
    if (
      durationBuckets.size > 0 &&
      !Array.from(durationBuckets).some((bucket) => matchesDurationBucket(listing, bucket))
    ) {
      return false
    }

    return true
  })

  listings = sortSnapshotListings([...listings], ordering)

  if (limit != null) {
    listings = listings.slice(0, limit)
  }

  const count = listings.length
  const start = (page - 1) * DEFAULT_PAGE_SIZE
  const end = start + DEFAULT_PAGE_SIZE
  const results = listings.slice(start, end).map(toRawListing)
  const next = end < count ? buildPageLink(requestUrl, page + 1) : null
  const previous = page > 1 && count > 0 ? buildPageLink(requestUrl, page - 1) : null

  return {
    count,
    next,
    previous,
    results,
  }
}
