import type { Listing } from './types'
import {
  extractSmartSearchIntent,
  COMPANY_QUERY_LABELS,
  DISPLAY_PLATFORM_LABELS,
  DISPLAY_SECTOR_LABELS,
  normalizeSearchValue,
} from './search-intent'

export function getListingSearchScore(
  listing: Listing,
  queryIntent: ReturnType<typeof extractSmartSearchIntent>,
  normalizedSearchText: string,
) {
  const title = normalizeSearchValue(listing.title)
  const company = normalizeSearchValue(listing.company_name)
  const location = normalizeSearchValue(`${listing.location ?? ''} ${listing.city ?? ''}`)
  const platform = normalizeSearchValue(
    listing.source_platform_label ?? listing.source_platform ?? '',
  )
  const sector = normalizeSearchValue(`${listing.sector ?? ''} ${listing.secondary_sector ?? ''}`)
  const description = normalizeSearchValue(listing.description ?? '')
  const companyAndTitle = `${company} ${title}`

  let score = 0
  let matchedTokenCount = 0

  queryIntent.companyKeys.forEach((companyKey) => {
    const canonicalCompany = normalizeSearchValue(COMPANY_QUERY_LABELS[companyKey] ?? '')
    if (canonicalCompany && company.includes(canonicalCompany)) {
      score += 140
    } else if (canonicalCompany && companyAndTitle.includes(canonicalCompany)) {
      score += 90
    }
  })

  queryIntent.platformKeys.forEach((platformKey) => {
    const platformLabel = normalizeSearchValue(DISPLAY_PLATFORM_LABELS[platformKey] ?? platformKey)
    if (platform.includes(platformLabel)) {
      score += 70
    }
  })

  queryIntent.sectorKeys.forEach((sectorKey) => {
    const sectorLabel = normalizeSearchValue(DISPLAY_SECTOR_LABELS[sectorKey] ?? sectorKey)
    if (sector.includes(sectorLabel)) {
      score += 60
    }
  })

  queryIntent.rawTokens.forEach((token) => {
    if (title.includes(token)) {
      score += 28
      matchedTokenCount += 1
      return
    }
    if (company.includes(token)) {
      score += 24
      matchedTokenCount += 1
      return
    }
    if (platform.includes(token) || sector.includes(token)) {
      score += 14
      matchedTokenCount += 1
      return
    }
    if (location.includes(token)) {
      score += 10
      matchedTokenCount += 1
      return
    }
    if (description.includes(token)) {
      score += 4
      matchedTokenCount += 1
    }
  })

  if (queryIntent.rawTokens.length > 1 && matchedTokenCount === queryIntent.rawTokens.length) {
    score += 40
  }

  if (normalizedSearchText) {
    if (title.includes(normalizedSearchText)) {
      score += 95
    }
    if (company.includes(normalizedSearchText)) {
      score += 80
    }
    if (companyAndTitle.includes(normalizedSearchText)) {
      score += 55
    }
  }

  return score
}

export function rankListingsBySearch(listings: Listing[], query: string) {
  const queryIntent = extractSmartSearchIntent(query)
  const hasSearchIntent =
    queryIntent.rawTokens.length > 0 ||
    queryIntent.companyKeys.length > 0 ||
    queryIntent.platformKeys.length > 0 ||
    queryIntent.sectorKeys.length > 0

  if (!hasSearchIntent) {
    return listings
  }

  const normalizedSearchText = normalizeSearchValue(queryIntent.searchText)

  return [...listings].sort((left, right) => {
    const scoreLeft = getListingSearchScore(left, queryIntent, normalizedSearchText)
    const scoreRight = getListingSearchScore(right, queryIntent, normalizedSearchText)

    if (scoreRight !== scoreLeft) {
      return scoreRight - scoreLeft
    }

    return (right.created_at ?? '').localeCompare(left.created_at ?? '')
  })
}
