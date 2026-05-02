import { FOCUS_AREA_LABELS, PLATFORM_LABELS } from '@/lib/helpers'

export const PLATFORM_QUERY_ALIASES: Record<string, string[]> = {
  linkedin: ['linkedin'],
  kariyer: ['kariyer', 'kariyer.net', 'kariyernet'],
  youthall: ['youthall'],
  anbea: ['anbean', 'anbea', 'anbean kampus', 'anbean kampüs'],
  boomerang: ['boomerang'],
  toptalent: ['toptalent', 'top talent'],
  savunma: ['savunma', 'savunma kariyer'],
  odtu_kpm: ['odtu', 'odtu kpm', 'odtü', 'odtü kpm'],
  bogazici_km: ['bogazici', 'bogazici kariyer', 'boğaziçi', 'boğaziçi kariyer'],
  ytu_orkam: ['ytu', 'ytu orkam', 'ytü', 'ytü orkam'],
  itu_kariyer: ['itu', 'itu kariyer', 'itü', 'itü kariyer'],
  pythiango: ['pythiango', 'pythian go'],
}

export const COMPANY_QUERY_ALIASES: Record<string, string[]> = {
  aselsan: ['aselsan'],
  roketsan: ['roketsan'],
  havelsan: ['havelsan'],
  turk_hava_yollari: ['thy', 'turk hava yollari', 'turkish airlines'],
  turkcell: ['turkcell'],
  turkiye_is_bankasi: ['is bankasi', 'isbank'],
  garanti_bbva: ['garanti', 'garanti bbva'],
  akbank: ['akbank'],
  yapi_kredi: ['yapi kredi'],
  tupras: ['tupras'],
  sisecam: ['sisecam'],
  arcelik: ['arcelik'],
  vestel: ['vestel'],
  ford_otosan: ['ford otosan'],
  tofas: ['tofas'],
  toyota: ['toyota'],
  mercedes_benz_turk: ['mercedes', 'mercedes benz', 'mercedes-benz', 'mercedes benz turk'],
  bosch: ['bosch'],
  unilever: ['unilever'],
  p_and_g: ['p&g', 'pg', 'procter and gamble', 'procter & gamble'],
  coca_cola_icecek: ['coca cola', 'coca-cola', 'coca cola icecek', 'cci'],
  pepsico: ['pepsico', 'pepsi'],
  trendyol: ['trendyol'],
  hepsiburada: ['hepsiburada', 'hepsi burada'],
  getir: ['getir'],
  amazon: ['amazon'],
  migros: ['migros'],
}

export const COMPANY_QUERY_LABELS: Record<string, string> = Object.fromEntries(
  Object.keys(COMPANY_QUERY_ALIASES).map((key) => [key, key.replace(/_/g, ' ')]),
) as Record<string, string>


export function normalizeSearchValue(value: string) {
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

type SearchableItem = {
  key: string
  candidates: string[]
}

function buildSearchableItems(labels: Record<string, string>, aliasMap: Record<string, string[]> = {}): SearchableItem[] {
  return Object.entries(labels).map(([key, label]) => ({
    key,
    candidates: [
      normalizeSearchValue(label),
      ...(aliasMap[key] ?? []).map(normalizeSearchValue)
    ]
  }))
}

const SEARCHABLE_SECTORS = buildSearchableItems(FOCUS_AREA_LABELS)
const SEARCHABLE_PLATFORMS = buildSearchableItems(PLATFORM_LABELS, PLATFORM_QUERY_ALIASES)
const SEARCHABLE_COMPANIES = buildSearchableItems(COMPANY_QUERY_LABELS, COMPANY_QUERY_ALIASES)

export function getMatchedSectorKeys(query: string) {
  const normalizedQuery = normalizeSearchValue(query)
  if (!normalizedQuery) return []

  return SEARCHABLE_SECTORS
    .filter(({ candidates }) => candidates[0].includes(normalizedQuery))
    .map(({ key }) => key)
}

export function getMatchedPlatformKeys(query: string) {
  const normalizedQuery = normalizeSearchValue(query)
  if (!normalizedQuery) return []

  return SEARCHABLE_PLATFORMS
    .filter(({ candidates }) => candidates[0].includes(normalizedQuery))
    .map(({ key }) => key)
}

export function tokenizeNormalizedSearchValue(value: string) {
  return normalizeSearchValue(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function getQueryMatches(query: string, items: SearchableItem[]) {
  const normalizedQuery = normalizeSearchValue(query)
  const queryTokens = tokenizeNormalizedSearchValue(query)
  if (!normalizedQuery && queryTokens.length === 0) return []

  return items
    .filter(({ candidates }) => {
      return candidates.some((candidate) => {
        if (normalizedQuery && candidate.includes(normalizedQuery)) {
          return true
        }

        return queryTokens.some((token) => candidate.includes(token) || token.includes(candidate))
      })
    })
    .map(({ key }) => key)
}

function getSmartMatchedSectorKeys(query: string) {
  return getQueryMatches(query, SEARCHABLE_SECTORS)
}

function getSmartMatchedPlatformKeys(query: string) {
  return getQueryMatches(query, SEARCHABLE_PLATFORMS)
}

function getIgnoredQueryTokens(
  keys: string[],
  labels: Record<string, string>,
  aliasMap: Record<string, string[]> = {},
) {
  const tokens = new Set<string>()

  keys.forEach((key) => {
    const values = [labels[key], ...(aliasMap[key] ?? [])].filter(Boolean)
    values.forEach((value) => {
      tokenizeNormalizedSearchValue(value).forEach((token) => {
        if (token.length >= 3) {
          tokens.add(token)
        }
      })
    })
  })

  return tokens
}

export function extractSmartSearchIntent(query: string) {
  const sectorKeys = getSmartMatchedSectorKeys(query)
  const platformKeys = getSmartMatchedPlatformKeys(query)
  const companyKeys = getQueryMatches(query, SEARCHABLE_COMPANIES)
  const ignoredTokens = new Set<string>([
    ...getIgnoredQueryTokens(sectorKeys, FOCUS_AREA_LABELS),
    ...getIgnoredQueryTokens(platformKeys, PLATFORM_LABELS, PLATFORM_QUERY_ALIASES),
    ...getIgnoredQueryTokens(companyKeys, COMPANY_QUERY_LABELS, COMPANY_QUERY_ALIASES),
  ])

  const searchTokens = query
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => {
      const normalizedToken = normalizeSearchValue(token)
      return normalizedToken.length < 3 || !ignoredTokens.has(normalizedToken)
    })
  companyKeys.forEach((key) => {
    tokenizeNormalizedSearchValue(COMPANY_QUERY_LABELS[key]).forEach((token) => {
      if (!searchTokens.some((searchToken) => normalizeSearchValue(searchToken) === token)) {
        searchTokens.push(token)
      }
    })
  })

  return {
    sectorKeys,
    platformKeys,
    companyKeys,
    rawTokens: tokenizeNormalizedSearchValue(query),
    searchText: searchTokens.join(' ').trim(),
  }
}
