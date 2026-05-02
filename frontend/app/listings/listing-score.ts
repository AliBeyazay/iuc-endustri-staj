import { Listing } from '@/types'
import {
  extractSmartSearchIntent,
  COMPANY_QUERY_LABELS,
  normalizeSearchValue,
} from './search-intent'
import { FOCUS_AREA_LABELS, PLATFORM_LABELS } from '@/lib/helpers'

export function getListingSearchScore(
  listing: Listing,
  queryIntent: ReturnType<typeof extractSmartSearchIntent>,
  normalizedSearchText: string,
) {
  const title = normalizeSearchValue(listing.title)
  const company = normalizeSearchValue(listing.company_name)
  const location = normalizeSearchValue(listing.location ?? '')
  const platform = normalizeSearchValue(
    PLATFORM_LABELS[listing.source_platform as keyof typeof PLATFORM_LABELS] ?? listing.source_platform ?? '',
  )
  const primarySector = listing.em_focus_area ? (FOCUS_AREA_LABELS[listing.em_focus_area] ?? listing.em_focus_area) : ''
  const secondarySector = listing.secondary_em_focus_area ? (FOCUS_AREA_LABELS[listing.secondary_em_focus_area] ?? listing.secondary_em_focus_area) : ''
  const sector = normalizeSearchValue(`${primarySector} ${secondarySector}`)
  const description = normalizeSearchValue(listing.description ?? '')
  const companyAndTitle = `${company} ${title}`

  let score = 0         // fixed signals: company/platform/sector keys + full-text
  let tokenScore = 0    // raw-token signals, normalized before adding to score
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
    const platformLabel = normalizeSearchValue(PLATFORM_LABELS[platformKey as keyof typeof PLATFORM_LABELS] ?? platformKey)
    if (platform.includes(platformLabel)) {
      score += 70
    }
  })

  queryIntent.sectorKeys.forEach((sectorKey) => {
    const sectorLabel = normalizeSearchValue(FOCUS_AREA_LABELS[sectorKey] ?? sectorKey)
    if (sector.includes(sectorLabel)) {
      score += 60
    }
  })

  queryIntent.rawTokens.forEach((token) => {
    if (title.includes(token)) {
      tokenScore += 28
      matchedTokenCount += 1
      return
    }
    if (company.includes(token)) {
      tokenScore += 24
      matchedTokenCount += 1
      return
    }
    if (platform.includes(token) || sector.includes(token)) {
      tokenScore += 14
      matchedTokenCount += 1
      return
    }
    if (location.includes(token)) {
      tokenScore += 10
      matchedTokenCount += 1
      return
    }
    if (description.includes(token)) {
      tokenScore += 4
      matchedTokenCount += 1
    }
  })

  // Multiply token score by match ratio (matched / total).
  // - All tokens matched  → ratio 1.0, full token score (replaces the old flat +40 bonus)
  // - Partial match       → proportional reduction
  // - 1-token title match → 28 × 1.0 = 28, always beats 5-token description-only (20 × 1.0 = 20)
  const tokenCount = queryIntent.rawTokens.length
  score += tokenCount > 0 ? tokenScore * (matchedTokenCount / tokenCount) : 0

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
