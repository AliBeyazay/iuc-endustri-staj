import { Listing } from '@/types'
import {
  extractSmartSearchIntent,
  COMPANY_QUERY_LABELS,
  normalizeSearchValue,
} from './search-intent'
import { FOCUS_AREA_LABELS, PLATFORM_LABELS } from '@/lib/helpers'

const FUZZY_THRESHOLD = 0.6

/** Dice bigram similarity — 1.0 for identical strings, 0.0 for no overlap. */
function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const aGrams = new Map<string, number>()
  for (let i = 0; i < a.length - 1; i++) {
    const g = a.slice(i, i + 2)
    aGrams.set(g, (aGrams.get(g) ?? 0) + 1)
  }
  let hits = 0
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.slice(i, i + 2)
    const count = aGrams.get(g) ?? 0
    if (count > 0) { aGrams.set(g, count - 1); hits++ }
  }
  return (2 * hits) / (a.length + b.length - 2)
}

/** True when `token` fuzzy-matches any whitespace-separated word in `text`. */
function fuzzyMatchesField(token: string, text: string): boolean {
  return text.split(/\s+/).some((word) => bigramSimilarity(token, word) >= FUZZY_THRESHOLD)
}

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

  let score = 0            // fixed signals: company/platform/sector keys + full-text
  let tokenScore = 0       // title/company/platform/location — ratio-weighted
  let matchedTokenCount = 0
  let descriptionScore = 0 // description — secondary bonus, capped, NOT ratio-weighted

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
    // Fuzzy fallback: reward near-matches (typos) in title/company at reduced weight.
    // Only reached when no exact match was found above.
    if (token.length >= 4) {
      if (fuzzyMatchesField(token, title)) {
        tokenScore += 18
        matchedTokenCount += 1
        return
      }
      if (fuzzyMatchesField(token, company)) {
        tokenScore += 14
        matchedTokenCount += 1
        return
      }
    }
    if (description.includes(token)) {
      // Description is a weak secondary signal: tracked separately so it
      // cannot inflate matchedTokenCount and thereby boost the ratio.
      descriptionScore += 2
    }
  })

  // Ratio weights title/company/platform/location matches; description is excluded
  // so a listing cannot achieve a high ratio purely through description hits.
  const tokenCount = queryIntent.rawTokens.length
  score += tokenCount > 0 ? tokenScore * (matchedTokenCount / tokenCount) : 0

  // Description bonus: capped at 8 so it always stays below a single title
  // match (28). Even 20 tokens in description contribute at most 8 points.
  score += Math.min(descriptionScore, 8)

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
