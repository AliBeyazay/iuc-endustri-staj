'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { BriefcaseBusiness, Clock3, MapPin, History } from 'lucide-react'
import useSWR from 'swr'
import UniversityLogo from '@/components/UniversityLogo'
import ProfileDropdown from '@/components/ProfileDropdown'
import { useRecentlyViewed } from '@/hooks'

type RawListing = {
  id: string | number
  title: string
  company_name: string
  company_logo_url?: string | null
  location?: string | null
  city?: string | null
  source_platform?: string | null
  is_talent_program?: boolean | null
  internship_type?: string | null
  application_deadline?: string | null
  source_url?: string | null
  application_url?: string | null
  description?: string | null
  created_at?: string | null
  em_focus_area?: string | null
  secondary_em_focus_area?: string | null
  em_focus_confidence?: number | null
}

type Listing = {
  id: string
  title: string
  company_name: string
  company_logo_url: string | null
  location: string | null
  city: string | null
  sector: string | null
  secondary_sector: string | null
  confidence: number | null
  source_platform: string | null
  source_platform_label: string | null
  is_talent_program: boolean
  employment_type: string | null
  deadline: string | null
  url: string | null
  description: string | null
  created_at: string | null
}

type SortOption = 'newest' | 'deadline' | 'company' | 'popular' | 'top_rated'

const RECENT_SEARCHES_KEY = 'iuc_listings_recent_searches'
const ITEMS_PER_PAGE = 20

const SECTOR_LABELS: Record<string, string> = {
  imalat_metal_makine: 'İmalat, Metal ve Makine',
  otomotiv_yan_sanayi: 'Otomotiv ve Yan Sanayi',
  yazilim_bilisim_teknoloji: 'Yazılım, Bilişim ve Teknoloji',
  hizmet_finans_danismanlik: 'Hizmet, Finans ve Danışmanlık',
  eticaret_perakende_fmcg: 'E-Ticaret, Perakende ve FMCG',
  savunma_havacilik_enerji: 'Savunma, Havacılık ve Enerji',
  gida_kimya_saglik: 'Gıda, Kimya ve Sağlık',
  lojistik_tasimacilik: 'Lojistik ve Taşımacılık',
  'lojistik_tasimacil\u0131k': 'Lojistik ve Ta\u015f\u0131mac\u0131l\u0131k',
  lojistik_ta\u015fimacilik: 'Lojistik ve Ta\u015f\u0131mac\u0131l\u0131k',
  tekstil_moda: 'Tekstil ve Moda',
  insaat_yapi_malzemeleri: 'İnşaat ve Yapı Malzemeleri',
  diger: 'Diğer',
}

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  kariyer: 'Kariyer.net',
  youthall: 'Youthall',
  anbea: 'Anbean Kampüs',
  boomerang: 'Boomerang',
  toptalent: 'TopTalent',
  savunma: 'Savunma Kariyer',
  odtu_kpm: 'ODTÜ KPM',
  bogazici_km: 'Boğaziçi Kariyer',
  ytu_orkam: 'YTU ORKAM',
  itu_kariyer: 'İTÜ Kariyer',
}

const SECTOR_ORDER = [
  'Yazılım, Bilişim ve Teknoloji',
  'Hizmet, Finans ve Danışmanlık',
  'Lojistik ve Taşımacılık',
  'Otomotiv ve Yan Sanayi',
  'E-Ticaret, Perakende ve FMCG',
  'İmalat, Metal ve Makine',
  'Savunma, Havacılık ve Enerji',
  'Gıda, Kimya ve Sağlık',
  'İnşaat ve Yapı Malzemeleri',
  'Diğer',
]

const DURATION_OPTIONS = [
  { value: '4_weeks', label: '4 hafta' },
  { value: '8_weeks', label: '8 hafta' },
  { value: '12_plus_weeks', label: '12+ hafta' },
] as const

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'newest', label: 'En yeni' },
  { value: 'deadline', label: 'Deadline yakindan uzağa' },
  { value: 'company', label: 'Sirket A-Z' },
  { value: 'popular', label: 'Populerlik (kaydetme)' },
  { value: 'top_rated', label: 'En yuksek puan' },
]

const DISPLAY_SECTOR_LABELS: Record<string, string> = {
  imalat_metal_makine: 'İmalat, Metal ve Makine',
  otomotiv_yan_sanayi: 'Otomotiv ve Yan Sanayi',
  yazilim_bilisim_teknoloji: 'Yazılım, Bilişim ve Teknoloji',
  hizmet_finans_danismanlik: 'Hizmet, Finans ve Danışmanlık',
  eticaret_perakende_fmcg: 'E-Ticaret, Perakende ve FMCG',
  savunma_havacilik_enerji: 'Savunma, Havacılık ve Enerji',
  gida_kimya_saglik: 'Gıda, Kimya ve Sağlık',
  lojistik_tasimacilik: 'Lojistik ve Taşımacılık',
  'lojistik_tasimacilÄ±k': 'Lojistik ve Taşımacılık',
  lojistik_taÅŸimacilik: 'Lojistik ve Taşımacılık',
  tekstil_moda: 'Tekstil ve Moda',
  insaat_yapi_malzemeleri: 'İnşaat ve Yapı Malzemeleri',
  diger: 'Diğer',
}

const DISPLAY_PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  kariyer: 'Kariyer.net',
  youthall: 'Youthall',
  anbea: 'Anbean Kampüs',
  boomerang: 'Boomerang',
  toptalent: 'TopTalent',
  savunma: 'Savunma Kariyer',
  odtu_kpm: 'ODTÜ KPM',
  bogazici_km: 'Boğaziçi Kariyer',
  ytu_orkam: 'YTÜ ORKAM',
  itu_kariyer: 'İTÜ Kariyer',
}

const PLATFORM_QUERY_ALIASES: Record<string, string[]> = {
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
}

const COMPANY_QUERY_ALIASES: Record<string, string[]> = {
  aselsan: ['aselsan'],
  roketsan: ['roketsan'],
  havelsan: ['havelsan'],
  turk_hava_yollari: ['thy', 'turk hava yollari', 'tÃ¼rk hava yollarÄ±', 'turkish airlines'],
  turkcell: ['turkcell'],
  turkiye_is_bankasi: ['is bankasi', 'iÅŸ bankasÄ±', 'isbank', 'iÅŸbank'],
  garanti_bbva: ['garanti', 'garanti bbva'],
  akbank: ['akbank'],
  yapi_kredi: ['yapi kredi', 'yapÄ± kredi'],
  tupras: ['tupras', 'tÃ¼praÅŸ'],
  sisecam: ['sisecam', 'ÅŸiÅŸecam'],
  arcelik: ['arcelik', 'arÃ§elik'],
  vestel: ['vestel'],
  ford_otosan: ['ford otosan'],
  tofas: ['tofas', 'tofaÅŸ'],
  toyota: ['toyota'],
  mercedes_benz_turk: ['mercedes', 'mercedes benz', 'mercedes-benz', 'mercedes benz turk'],
  bosch: ['bosch'],
  unilever: ['unilever'],
  p_and_g: ['p&g', 'pg', 'procter and gamble', 'procter & gamble'],
  coca_cola_icecek: ['coca cola', 'coca-cola', 'coca cola icecek', 'coca cola iÃ§ecek', 'cci'],
  pepsico: ['pepsico', 'pepsi'],
  trendyol: ['trendyol'],
  hepsiburada: ['hepsiburada', 'hepsi burada'],
  getir: ['getir'],
  amazon: ['amazon'],
  migros: ['migros'],
}

const COMPANY_QUERY_LABELS: Record<string, string> = Object.fromEntries(
  Object.keys(COMPANY_QUERY_ALIASES).map((key) => [key, key.replace(/_/g, ' ')]),
) as Record<string, string>

function formatDate(value?: string | null) {
  if (!value) return 'Belirtilmedi'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Belirtilmedi'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function daysLeft(deadline?: string | null) {
  if (!deadline) return null
  const today = new Date()
  const end = new Date(deadline)
  if (Number.isNaN(end.getTime())) return null
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.ceil((end.getTime() - base) / (1000 * 60 * 60 * 24))
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

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

function getMatchedSectorKeys(query: string) {
  const normalizedQuery = normalizeSearchValue(query)
  if (!normalizedQuery) return []

  return Object.entries(DISPLAY_SECTOR_LABELS)
    .filter(([, label]) => normalizeSearchValue(label).includes(normalizedQuery))
    .map(([key]) => key)
}

function getMatchedPlatformKeys(query: string) {
  const normalizedQuery = normalizeSearchValue(query)
  if (!normalizedQuery) return []

  return Object.entries(DISPLAY_PLATFORM_LABELS)
    .filter(([, label]) => normalizeSearchValue(label).includes(normalizedQuery))
    .map(([key]) => key)
}

function tokenizeNormalizedSearchValue(value: string) {
  return normalizeSearchValue(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function getQueryMatches(
  query: string,
  labels: Record<string, string>,
  aliasMap: Record<string, string[]> = {},
) {
  const normalizedQuery = normalizeSearchValue(query)
  const queryTokens = tokenizeNormalizedSearchValue(query)
  if (!normalizedQuery && queryTokens.length === 0) return []

  return Object.entries(labels)
    .filter(([key, label]) => {
      const candidates = [
        normalizeSearchValue(label),
        ...(aliasMap[key] ?? []).map((alias) => normalizeSearchValue(alias)),
      ]

      return candidates.some((candidate) => {
        if (normalizedQuery && candidate.includes(normalizedQuery)) {
          return true
        }

        return queryTokens.some((token) => candidate.includes(token) || token.includes(candidate))
      })
    })
    .map(([key]) => key)
}

function getSmartMatchedSectorKeys(query: string) {
  return getQueryMatches(query, DISPLAY_SECTOR_LABELS)
}

function getSmartMatchedPlatformKeys(query: string) {
  return getQueryMatches(query, DISPLAY_PLATFORM_LABELS, PLATFORM_QUERY_ALIASES)
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

function extractSmartSearchIntent(query: string) {
  const sectorKeys = getSmartMatchedSectorKeys(query)
  const platformKeys = getSmartMatchedPlatformKeys(query)
  const companyKeys = getQueryMatches(query, COMPANY_QUERY_LABELS, COMPANY_QUERY_ALIASES)
  const ignoredTokens = new Set<string>([
    ...getIgnoredQueryTokens(sectorKeys, DISPLAY_SECTOR_LABELS),
    ...getIgnoredQueryTokens(platformKeys, DISPLAY_PLATFORM_LABELS, PLATFORM_QUERY_ALIASES),
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

function cleanSummaryText(raw?: string | null) {
  if (!raw) return ''

  let text = raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\bShow more\b/gi, '')
    .replace(/\bShow less\b/gi, '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const noisePatterns = [
    /home companies jobs events privileges academy blog youth login sign up for employers/gi,
    /companies jobs events privileges academy schools okullar öğrenci kulüpleri/gi,
    /turkish english youthall premium/gi,
    /kurum\/firma:.*$/gi,
    /işveren web sitesi:.*$/gi,
    /pozisyon:.*$/gi,
    /bitiş tarihi:.*$/gi,
    /location:.*$/gi,
    /type of contract:.*$/gi,
  ]

  for (const pattern of noisePatterns) {
    text = text.replace(pattern, ' ')
  }

  return text.replace(/\s+/g, ' ').trim()
}

function splitSummarySentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function isUsefulSummarySentence(sentence: string) {
  const lower = sentence.toLowerCase()

  if (sentence.length < 28) return false

  const weakPatterns = [
    'home companies jobs events',
    'turkish english youthall',
    'kurum/firma:',
    'pozisyon:',
    'işveren web sitesi:',
    'bitiş tarihi:',
    'location:',
    'type of contract:',
    'www.',
    'http://',
    'https://',
  ]

  return !weakPatterns.some((pattern) => lower.includes(pattern))
}

function trimSummarySentence(sentence: string) {
  const normalized = sentence.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 150) return normalized

  const shortened = normalized.slice(0, 147)
  const lastSpace = shortened.lastIndexOf(' ')
  return `${shortened.slice(0, lastSpace > 80 ? lastSpace : shortened.length).trim()}...`
}

function normalizeListing(item: RawListing): Listing {
  const primarySectorKey = item.em_focus_area?.replace('ı', 'i') ?? null
  const secondarySectorKey = item.secondary_em_focus_area?.replace('ı', 'i') ?? null

  return {
    id: String(item.id),
    title: item.title,
    company_name: item.company_name,
    company_logo_url: item.company_logo_url ?? null,
    location: item.location ?? null,
    city: item.city ?? null,
    sector: primarySectorKey ? (DISPLAY_SECTOR_LABELS[primarySectorKey] ?? primarySectorKey) : null,
    secondary_sector: secondarySectorKey
      ? (DISPLAY_SECTOR_LABELS[secondarySectorKey] ?? secondarySectorKey)
      : null,
    confidence: typeof item.em_focus_confidence === 'number' ? item.em_focus_confidence : null,
    source_platform: item.source_platform ?? null,
    source_platform_label: item.source_platform
      ? (DISPLAY_PLATFORM_LABELS[item.source_platform] ?? item.source_platform)
      : null,
    is_talent_program: Boolean(item.is_talent_program),
    employment_type: item.internship_type ?? null,
    deadline: item.application_deadline ?? null,
    url: item.application_url ?? item.source_url ?? null,
    description: item.description ?? null,
    created_at: item.created_at ?? null,
  }
}

function getListingSummary(item: Listing) {
  const summary = cleanSummaryText(item.description)
  if (summary) {
    const sentences = splitSummarySentences(summary)
    const meaningfulSentence = sentences.find(isUsefulSummarySentence)

    if (meaningfulSentence) {
      return trimSummarySentence(meaningfulSentence)
    }

    if (sentences[0]) {
      return trimSummarySentence(sentences[0])
    }

    return trimSummarySentence(summary)
  }
  return `${item.company_name} için yayınlanan bu ilan, ${item.sector?.toLowerCase() ?? 'ilgili alanlarda'} kariyer hedefleyen öğrenciler için derlendi.`
}

function getCompanyBadgeText(companyName: string) {
  return companyName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function getCompanyMonogramStyle(companyName: string) {
  const palettes = [
    'from-[#eef4ff] to-[#f8fbff] text-[#173156] border-[#d9e5fb]',
    'from-[#f7f2ff] to-[#fbf8ff] text-[#4c2f82] border-[#e6dafc]',
    'from-[#effaf5] to-[#f8fffb] text-[#14694b] border-[#d7f2e5]',
    'from-[#fff7ed] to-[#fffbf5] text-[#9a4f14] border-[#f6dfc4]',
  ]
  const seed = companyName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return palettes[seed % palettes.length]
}

function getEmploymentTypeLabel(type?: string | null) {
  if (!type) return 'Belirsiz'
  if (type === 'zorunlu') return 'Zorunlu'
  if (type === 'gonullu') return 'Gönüllü'
  if (type === 'belirsiz') return 'Belirsiz'
  return type
}

function getWorkModelLabel(item: Listing) {
  const location = `${item.location ?? ''} ${item.city ?? ''}`.toLowerCase()
  if (location.includes('hibrit') || location.includes('hybrid')) return 'Hibrit'
  if (location.includes('remote') || location.includes('uzaktan')) return 'Uzaktan'
  if (location.includes('onsite') || location.includes('ofis') || location.includes('yerinde')) {
    return 'Yerinde'
  }
  return item.location || item.city || 'Konum'
}

function getOrderingValue(sortBy: SortOption) {
  switch (sortBy) {
    case 'deadline':
      return 'application_deadline'
    case 'company':
      return 'company_name'
    case 'popular':
      return '-bookmark_count'
    case 'top_rated':
      return '-average_rating'
    case 'newest':
    default:
      return '-created_at'
  }
}

function buildListingsApiQuery(params: {
  page: number
  query: string
  selectedSectors: string[]
  selectedPlatforms: string[]
  selectedDurations: string[]
  talentOnly: boolean
  sortBy: SortOption
}) {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(params.page))
  searchParams.set('ordering', getOrderingValue(params.sortBy))

  const queryIntent = extractSmartSearchIntent(params.query)

  if (queryIntent.searchText) {
    searchParams.set('search', queryIntent.searchText)
  }

  const sectorKeys = new Set<string>()
  const platformKeys = new Set<string>()

  params.selectedSectors.forEach((sectorLabel) => {
    const sectorKey = Object.entries(DISPLAY_SECTOR_LABELS).find(
      ([, value]) => value === sectorLabel,
    )?.[0]
    if (sectorKey) {
      sectorKeys.add(sectorKey)
    }
  })

  queryIntent.sectorKeys.forEach((sectorKey) => {
    sectorKeys.add(sectorKey)
  })

  sectorKeys.forEach((sectorKey) => {
    searchParams.append('em_focus_area', sectorKey)
  })

  params.selectedPlatforms.forEach((platformLabel) => {
    const platformKey = Object.entries(DISPLAY_PLATFORM_LABELS).find(
      ([, value]) => value === platformLabel,
    )?.[0]
    if (platformKey) {
      platformKeys.add(platformKey)
    }
  })

  queryIntent.platformKeys.forEach((platformKey) => {
    platformKeys.add(platformKey)
  })

  platformKeys.forEach((platformKey) => {
    searchParams.append('source_platform', platformKey)
  })

  params.selectedDurations.forEach((durationValue) => {
    searchParams.append('duration_bucket', durationValue)
  })

  if (params.talentOnly) {
    searchParams.set('is_talent_program', 'true')
  }

  return searchParams.toString()
}

function rankListingsBySearch(listings: Listing[], query: string) {
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

function getListingSearchScore(
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

type FilterPanelProps = {
  sectors: string[]
  platforms: string[]
  durations: ReadonlyArray<{ value: string; label: string }>
  selectedSectors: string[]
  selectedPlatforms: string[]
  selectedDurations: string[]
  talentOnly: boolean
  onToggleSector: (value: string) => void
  onTogglePlatform: (value: string) => void
  onToggleDuration: (value: string) => void
  onToggleTalent: () => void
  onClearAll: () => void
}

function FilterPanel({
  sectors,
  platforms,
  durations,
  selectedSectors,
  selectedPlatforms,
  selectedDurations,
  talentOnly,
  onToggleSector,
  onTogglePlatform,
  onToggleDuration,
  onToggleTalent,
  onClearAll,
}: FilterPanelProps) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-[#132843] dark:text-[#e7edf4]">Sektör</h3>
        <div className="filter-scrollbar max-h-[360px] overflow-y-scroll pr-1">
          <div className="flex flex-col gap-2">
          {sectors.map((sector) => {
            const active = selectedSectors.includes(sector)
            return (
              <button
                key={sector}
                type="button"
                onClick={() => onToggleSector(sector)}
                className={classNames(
                  'w-full rounded-full border px-3 py-2 text-left text-xs font-medium transition',
                  active
                    ? 'border-[rgba(216,173,67,0.18)] bg-[rgba(216,173,67,0.14)] text-[#8f670b] dark:text-[#f0cf7a]'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10',
                )}
              >
                {sector}
              </button>
            )
          })}
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-[#132843] dark:text-[#e7edf4]">Sure</h3>
        <div className="flex flex-col gap-2">
          {durations.map((duration) => {
            const active = selectedDurations.includes(duration.value)
            return (
              <button
                key={duration.value}
                type="button"
                onClick={() => onToggleDuration(duration.value)}
                className={classNames(
                  'w-full rounded-full border px-3 py-2 text-left text-xs font-medium transition',
                  active
                    ? 'border-[rgba(216,173,67,0.18)] bg-[rgba(216,173,67,0.14)] text-[#8f670b] dark:text-[#f0cf7a]'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10',
                )}
              >
                {duration.label}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-[#132843] dark:text-[#e7edf4]">Yetenek Programı</h3>
        <button
          type="button"
          onClick={onToggleTalent}
          className={classNames(
            'w-full rounded-2xl border px-4 py-2 text-left text-sm font-medium transition',
            talentOnly
              ? 'border-[rgba(216,173,67,0.18)] bg-[rgba(216,173,67,0.14)] text-[#8f670b] dark:text-[#f0cf7a]'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10',
          )}
        >
          Yetenek Programları
        </button>
      </section>

      <button
        type="button"
        onClick={onClearAll}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
      >
        Filtreleri temizle
      </button>
    </div>
  )
}

export default function ListingsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedDurations, setSelectedDurations] = useState<string[]>([])
  const [talentOnly, setTalentOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const searchBoxRef = useRef<HTMLDivElement>(null)
  const { recentItems, clearAll: clearRecentlyViewed } = useRecentlyViewed()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (raw) setRecentSearches(JSON.parse(raw))
    } catch {
      // ignore
    }
  }, [])

  const swrKey = useMemo(() => {
    const queryString = buildListingsApiQuery({
      page: currentPage,
      query: debouncedQuery,
      selectedSectors,
      selectedPlatforms,
      selectedDurations,
      talentOnly,
      sortBy,
    })
    return `/api/listings?${queryString}`
  }, [currentPage, debouncedQuery, selectedPlatforms, selectedSectors, selectedDurations, sortBy, talentOnly])

  const listingsFetcher = useCallback(async (url: string) => {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error('İlanlar alınamadı.')
    return response.json()
  }, [])

  const { data: swrData, error: swrError, isLoading: loading } = useSWR(swrKey, listingsFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
    keepPreviousData: true,
  })

  const listings = useMemo(() => {
    if (!swrData) return []
    const items = Array.isArray(swrData)
      ? swrData
      : Array.isArray(swrData?.results)
        ? swrData.results
        : []
    const normalizedItems = items.map(normalizeListing)
    return rankListingsBySearch(normalizedItems, debouncedQuery)
  }, [swrData, debouncedQuery])

  const totalCount = useMemo(() => {
    if (!swrData) return 0
    const items = Array.isArray(swrData)
      ? swrData
      : Array.isArray(swrData?.results)
        ? swrData.results
        : []
    return Array.isArray(swrData) ? items.length : Number(swrData?.count ?? items.length)
  }, [swrData])

  const error = swrError ? (swrError instanceof Error ? swrError.message : 'Beklenmeyen hata oluştu.') : null

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const sectors = useMemo(() => SECTOR_ORDER, [])

  const platforms = useMemo(
    () => [
      'LinkedIn',
      'Kariyer.net',
      'Youthall',
      'Anbean Kampüs',
      'Boomerang',
      'TopTalent',
      'Savunma Kariyer',
      'ODTÜ KPM',
      'Boğaziçi Kariyer',
      'YTÜ ORKAM',
      'İTÜ Kariyer',
    ],
    [],
  )

  const autocompleteSuggestions = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query)
    if (!normalizedQuery) return []

    const matches = new Set<string>()

    sectors.forEach((sector) => {
      if (normalizeSearchValue(sector).includes(normalizedQuery)) {
        matches.add(sector)
      }
    })

    platforms.forEach((platform) => {
      if (normalizeSearchValue(platform).includes(normalizedQuery)) {
        matches.add(platform)
      }
    })

    listings.forEach((item) => {
      if (normalizeSearchValue(item.company_name).includes(normalizedQuery)) {
        matches.add(item.company_name)
      }
      if (normalizeSearchValue(item.title).includes(normalizedQuery)) {
        matches.add(item.title)
      }
      if (item.location && normalizeSearchValue(item.location).includes(normalizedQuery)) {
        matches.add(item.location)
      }
      if (item.city && normalizeSearchValue(item.city).includes(normalizedQuery)) {
        matches.add(item.city)
      }
    })

    return Array.from(matches).slice(0, 8)
  }, [listings, query])

  const urgentCount = useMemo(() => {
    return listings.filter((item) => {
      const left = daysLeft(item.deadline)
      return left != null && left >= 0 && left <= 7
    }).length
  }, [listings])

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE))

  const pageWindow = useMemo(() => {
    const start = Math.max(1, currentPage - 2)
    const end = Math.min(totalPages, start + 4)
    const adjustedStart = Math.max(1, end - 4)
    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index)
  }, [currentPage, totalPages])

  const visibleRange = useMemo(() => {
    if (totalCount === 0 || listings.length === 0) {
      return { start: 0, end: 0 }
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE + 1
    const end = start + listings.length - 1
    return { start, end }
  }, [currentPage, listings.length, totalCount])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedQuery, selectedPlatforms, selectedSectors, selectedDurations, sortBy, talentOnly])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const dynamicTitle = useMemo(() => {
    const sectorText =
      selectedSectors.length === 0
        ? 'aktif staj ve yetenek programları'
        : `${selectedSectors.slice(0, 3).join(', ')} alanındaki aktif staj ilanları`

    if (talentOnly && selectedPlatforms.length > 0) {
      return `${selectedPlatforms.join(', ')} platformundaki ${sectorText}`
    }

    if (talentOnly) {
      return `Yetenek programlarına uygun ${sectorText}`
    }

    if (selectedPlatforms.length > 0) {
      return `${selectedPlatforms.join(', ')} platformundaki ${sectorText}`
    }

    return sectorText.charAt(0).toUpperCase() + sectorText.slice(1)
  }, [selectedPlatforms, selectedSectors, talentOnly])

  function toggleItem(
    value: string,
    selected: string[],
    setter: Dispatch<SetStateAction<string[]>>,
  ) {
    if (selected.includes(value)) {
      setter(selected.filter((item) => item !== value))
      return
    }

    setter([...selected, value])
  }

  function clearAllFilters() {
    setQuery('')
    setDebouncedQuery('')
    setSelectedSectors([])
    setSelectedPlatforms([])
    setSelectedDurations([])
    setTalentOnly(false)
    setSortBy('newest')
  }

  function persistRecentSearch(term: string) {
    const cleanTerm = term.trim()
    if (!cleanTerm) return

    const nextSearches = [cleanTerm, ...recentSearches.filter((item) => item !== cleanTerm)].slice(
      0,
      5,
    )

    setRecentSearches(nextSearches)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextSearches))
  }

  function submitSuggestion(value: string) {
    setQuery(value)
    setDebouncedQuery(value)
    setShowSuggestions(false)
    persistRecentSearch(value)
  }

  const activeFilterCount =
    selectedSectors.length + selectedPlatforms.length + selectedDurations.length + (talentOnly ? 1 : 0)

  const summaryCards = [
    { label: 'Toplam Sonuç', value: totalCount },
    { label: 'Seçili Sektör', value: selectedSectors.length },
    { label: 'Yakın Son Başvuru', value: urgentCount },
  ]

  const SIDEBAR_SECTORS = [
    { label: 'Yazılım, Bilişim', value: 'Yazılım, Bilişim ve Teknoloji', icon: '💻' },
    { label: 'Üretim', value: 'İmalat, Metal ve Makine', icon: '🏭' },
    { label: 'Lojistik', value: 'Lojistik ve Taşımacılık', icon: '🚚' },
    { label: 'Enerji', value: 'Savunma, Havacılık ve Enerji', icon: '⚡' },
    { label: 'Finans', value: 'Hizmet, Finans ve Danışmanlık', icon: '🏦' },
    { label: 'E-Ticaret', value: 'E-Ticaret, Perakende ve FMCG', icon: '🛒' },
    { label: 'Gıda, Kimya', value: 'Gıda, Kimya ve Sağlık', icon: '🧪' },
    { label: 'Otomotiv', value: 'Otomotiv ve Yan Sanayi', icon: '🚗' },
    { label: 'İnşaat', value: 'İnşaat ve Yapı Malzemeleri', icon: '🏗️' },
    { label: 'Diğer', value: 'Diğer', icon: '📁' },
  ]

  const SECTOR_TAG_COLORS: Record<string, string> = {
    'Yazılım, Bilişim ve Teknoloji': 'bg-emerald-600 text-white',
    'Hizmet, Finans ve Danışmanlık': 'bg-blue-600 text-white',
    'Lojistik ve Taşımacılık': 'bg-red-600 text-white',
    'Otomotiv ve Yan Sanayi': 'bg-orange-600 text-white',
    'E-Ticaret, Perakende ve FMCG': 'bg-pink-600 text-white',
    'İmalat, Metal ve Makine': 'bg-slate-600 text-white',
    'Savunma, Havacılık ve Enerji': 'bg-[#132843] text-white',
    'Gıda, Kimya ve Sağlık': 'bg-teal-600 text-white',
    'İnşaat ve Yapı Malzemeleri': 'bg-amber-700 text-white',
    'Tekstil ve Moda': 'bg-purple-600 text-white',
    'Diğer': 'bg-gray-500 text-white',
  }

  function getSectorTagColor(sectorLabel: string | null) {
    if (!sectorLabel) return 'bg-gray-500 text-white'
    return SECTOR_TAG_COLORS[sectorLabel] ?? 'bg-gray-500 text-white'
  }

  function getSectorShortLabel(sectorLabel: string | null) {
    if (!sectorLabel) return 'Diğer'
    const map: Record<string, string> = {
      'Yazılım, Bilişim ve Teknoloji': 'Teknoloji',
      'Hizmet, Finans ve Danışmanlık': 'Finans',
      'Lojistik ve Taşımacılık': 'Lojistik',
      'Otomotiv ve Yan Sanayi': 'Otomotiv',
      'E-Ticaret, Perakende ve FMCG': 'E-Ticaret',
      'İmalat, Metal ve Makine': 'İmalat',
      'Savunma, Havacılık ve Enerji': 'Savunma',
      'Gıda, Kimya ve Sağlık': 'Sağlık',
      'İnşaat ve Yapı Malzemeleri': 'İnşaat',
      'Tekstil ve Moda': 'Tekstil',
      'Diğer': 'Diğer',
    }
    return map[sectorLabel] ?? sectorLabel
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f9f9ff] dark:bg-[#0e1e33]">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-[#1A233A] shadow-md" style={{ borderBottom: '2px solid transparent', borderImage: 'linear-gradient(to right, #B8860B, #F3E5AB, #B8860B) 1' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-0 sm:px-6" style={{ height: '64px' }}>
          <Link href="/listings" className="flex items-center gap-4">
            <UniversityLogo className="h-10 w-10 shrink-0 rounded border border-[#D4AF37] p-0.5" />
            <div className="min-w-0">
              <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37] sm:text-sm">
                İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA
              </span>
              <p className="truncate text-[9px] tracking-wider text-gray-300 sm:text-xs">
                ENDÜSTRİ MÜHENDİSLİĞİ STAJ PLATFORMU
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-8">
            <div className="hidden items-center gap-8 sm:flex">
              {[
                { label: 'İlanlar', href: '/listings' },
                { label: 'Başvurular', href: '/dashboard' },
                { label: 'Profil', href: '/profile' },
              ].map((nav) => (
                <Link
                  key={nav.href}
                  href={nav.href}
                  className={`text-sm font-medium transition-colors ${
                    nav.href === '/listings'
                      ? 'border-b-2 border-[#D4AF37] pb-1 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {nav.label}
                </Link>
              ))}
            </div>
            <ProfileDropdown />
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="bg-[#132843] px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="campus-heading text-2xl leading-tight text-white sm:text-4xl lg:text-5xl">
            ENDÜSTRİ MÜHENDİSLİĞİ ODAKLI STAJ VE YETENEK PROGRAMLARINI TEK EKRANDA KEŞFET.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
            LinkedIn, Youthall, Anbean, TopTalent ve diğer kaynaklardan çekilen ilanları tek
            bir akışta takip et.
          </p>

          {/* Search */}
          <div className="relative z-[90] mx-auto mt-8 max-w-2xl" ref={searchBoxRef}>
            <div className="flex items-center rounded-xl bg-white shadow-lg dark:bg-[#1a2d45]">
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    persistRecentSearch(query)
                    setShowSuggestions(false)
                  }
                }}
                placeholder="Şirket, pozisyon veya anahtar kelime ara..."
                className="w-full rounded-l-xl bg-transparent px-5 py-4 text-[15px] text-[#132843] outline-none placeholder:text-gray-400 dark:text-[#e7edf4] dark:placeholder:text-[#e7edf4]/30"
              />
              <button
                type="button"
                onClick={() => {
                  persistRecentSearch(query)
                  setShowSuggestions(false)
                }}
                className="shrink-0 rounded-r-xl bg-[#d8ad43] px-6 py-4 text-sm font-bold uppercase tracking-wider text-[#132843] transition-colors hover:bg-[#c79828]"
              >
                İLANLARI BUL
              </button>
            </div>

            {showSuggestions && (
              <div className="absolute left-0 top-full z-[94] mt-2 max-h-[320px] w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#1a2d45]">
                {autocompleteSuggestions.length > 0 && (
                  <div className="mb-2">
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Öneriler
                    </p>
                    {autocompleteSuggestions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => submitSuggestion(item)}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#173156] hover:bg-[#f5f0e0] dark:text-[#e7edf4] dark:hover:bg-white/10"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}

                {recentSearches.length > 0 && (
                  <div>
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-[#e7edf4]/40">
                      Son aramalar
                    </p>
                    {recentSearches.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => submitSuggestion(item)}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#173156] hover:bg-[#f5f0e0] dark:text-[#e7edf4] dark:hover:bg-white/10"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}

                {autocompleteSuggestions.length === 0 && recentSearches.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-400">
                    Henüz öneri yok. Firma adı, şehir veya pozisyon yaz.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Summary Cards ── */}
      <section className="bg-[#f9f9ff] px-4 py-6 dark:bg-[#0e1e33]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:gap-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-5 py-4 text-center shadow-sm dark:border-white/10 dark:bg-[#1a2d45]"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-[#e7edf4]/40">{card.label}</p>
              <p className="mt-1 text-3xl font-bold text-[#132843] dark:text-[#e7edf4]">{loading ? '...' : card.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Active Filters ── */}
      {(selectedSectors.length > 0 || selectedPlatforms.length > 0 || selectedDurations.length > 0 || talentOnly) && (
        <div className="bg-[#f9f9ff] px-4 pb-2 dark:bg-[#0e1e33]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
            {selectedSectors.map((sector) => (
              <button
                key={sector}
                type="button"
                onClick={() => setSelectedSectors(selectedSectors.filter((item) => item !== sector))}
                className="rounded-full bg-[#132843] px-3 py-1 text-xs font-medium text-white"
              >
                {sector} ×
              </button>
            ))}
            {selectedPlatforms.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => setSelectedPlatforms(selectedPlatforms.filter((item) => item !== platform))}
                className="rounded-full bg-[#132843] px-3 py-1 text-xs font-medium text-white"
              >
                {platform} ×
              </button>
            ))}
            {selectedDurations.map((durationValue) => {
              const durationLabel = DURATION_OPTIONS.find((item) => item.value === durationValue)?.label ?? durationValue
              return (
                <button
                  key={durationValue}
                  type="button"
                  onClick={() => setSelectedDurations(selectedDurations.filter((item) => item !== durationValue))}
                  className="rounded-full bg-[#132843] px-3 py-1 text-xs font-medium text-white"
                >
                  {durationLabel} ×
                </button>
              )
            })}
            {talentOnly && (
              <button type="button" onClick={() => setTalentOnly(false)} className="rounded-full bg-[#132843] px-3 py-1 text-xs font-medium text-white">
                Yetenek Programı ×
              </button>
            )}
            <button type="button" onClick={clearAllFilters} className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
              Tümünü temizle
            </button>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <section className="flex-1 bg-[#f9f9ff] px-4 pb-12 dark:bg-[#0e1e33]">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1a2d45]">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-[#132843] dark:text-[#e7edf4]">Sektör Filtreleri</h3>
              <ul className="space-y-1">
                {SIDEBAR_SECTORS.map((sector) => {
                  const isActive = selectedSectors.includes(sector.value)
                  return (
                    <li key={sector.value}>
                      <button
                        type="button"
                        onClick={() => toggleItem(sector.value, selectedSectors, setSelectedSectors)}
                        className={classNames(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                          isActive
                            ? 'bg-[#132843] text-white'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-[#132843] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-[#e7edf4]',
                        )}
                      >
                        <span className="text-lg">{sector.icon}</span>
                        {sector.label}
                      </button>
                    </li>
                  )
                })}
              </ul>

              <hr className="my-4 border-gray-200 dark:border-white/10" />

              {/* Platform Filters */}
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[#132843] dark:text-[#e7edf4]">Platform</h3>
              <ul className="space-y-1">
                {platforms.map((platform) => {
                  const isActive = selectedPlatforms.includes(platform)
                  return (
                    <li key={platform}>
                      <button
                        type="button"
                        onClick={() => toggleItem(platform, selectedPlatforms, setSelectedPlatforms)}
                        className={classNames(
                          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                          isActive
                            ? 'bg-[#132843] text-white'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-[#132843] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-[#e7edf4]',
                        )}
                      >
                        {platform}
                      </button>
                    </li>
                  )
                })}
              </ul>

              <hr className="my-4 border-gray-200 dark:border-white/10" />

              {/* Talent Only */}
              <button
                type="button"
                onClick={() => setTalentOnly((prev) => !prev)}
                className={classNames(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  talentOnly ? 'bg-[#d8ad43] text-[#132843]' : 'text-gray-600 hover:bg-gray-100',
                )}
              >
                <span className="text-lg">⭐</span>
                Yetenek Programları
              </button>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-4 w-full rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
                >
                  Filtreleri Temizle
                </button>
              )}
            </div>
          </aside>

          {/* Main Grid */}
          <main>
            {/* Header Row */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#132843] dark:text-[#e7edf4]">{dynamicTitle}</h2>
                {!loading && listings.length > 0 && (
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-[#e7edf4]/50">
                    {visibleRange.start}-{visibleRange.end} arası gösteriliyor (Sayfa {currentPage}/{totalPages})
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#132843] shadow-sm lg:hidden dark:border-white/10 dark:bg-[#1a2d45] dark:text-[#e7edf4]"
                >
                  Filtreler
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-[#132843] px-2 py-0.5 text-xs text-white">{activeFilterCount}</span>
                  )}
                </button>

                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                  className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#132843] outline-none shadow-sm dark:border-white/10 dark:bg-[#1a2d45] dark:text-[#e7edf4]"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Listings */}
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-64 rounded-xl border border-gray-200 bg-white campus-shimmer dark:border-white/10 dark:bg-[#1a2d45]" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-800/30 dark:bg-rose-900/20">
                <p className="text-lg font-semibold text-rose-800">Veri yüklenemedi</p>
                <p className="mt-2 text-sm text-rose-700">{error}</p>
                <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white">
                  Tekrar dene
                </button>
              </div>
            ) : listings.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-white/10 dark:bg-[#1a2d45]">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#d8ad43]/10">
                  <svg className="h-8 w-8 text-[#d8ad43]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-[#132843] dark:text-[#e7edf4]">Sonuç bulunamadı</p>
                <p className="mt-2 text-sm text-gray-500 dark:text-[#e7edf4]/50">Seçtiğin filtre kombinasyonu fazla dar olabilir.</p>
                <button type="button" onClick={clearAllFilters} className="mt-4 rounded-lg bg-[#132843] px-4 py-2 text-sm font-medium text-white">
                  Filtreleri temizle
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {listings.map((item) => {
                    return (
                      <article
                        key={item.id}
                        className="group relative flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#1a2d45]"
                      >
                        <div className="flex-1 p-5">
                          {/* Company + Title */}
                          <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-gray-200 bg-white dark:border-white/10 dark:bg-[#0e1e33]">
                              {item.company_logo_url ? (
                                <img
                                  src={item.company_logo_url}
                                  alt={item.company_name}
                                  className="h-10 w-10 object-contain"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => { (e.currentTarget).style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement)?.style.removeProperty('display') }}
                                />
                              ) : null}
                              {item.company_logo_url ? (
                                <span style={{ display: 'none' }} className="text-sm font-bold text-[#132843]">
                                  {getCompanyBadgeText(item.company_name)}
                                </span>
                              ) : (
                                <span className="text-sm font-bold text-[#132843] dark:text-[#e7edf4]">
                                  {getCompanyBadgeText(item.company_name)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-[15px] font-bold leading-snug text-[#132843] group-hover:text-[#1E3A5F] dark:text-[#e7edf4] dark:group-hover:text-[#d8ad43]">
                                {item.title}
                              </h3>
                              <p className="mt-1 text-sm text-gray-500 dark:text-[#e7edf4]/50">{item.company_name}</p>
                            </div>
                          </div>

                          {/* Meta */}
                          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-[#e7edf4]/50">
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin size={14} />
                              {getWorkModelLabel(item)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 size={14} />
                              {formatDate(item.deadline)}
                            </span>
                          </div>

                          {/* Employment Type Tag */}
                          <div className="mt-3">
                            <span className="inline-block rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                              {getEmploymentTypeLabel(item.employment_type)}
                            </span>
                          </div>
                        </div>

                        {/* Detail Button */}
                        <Link
                          href={`/listings/${item.id}`}
                          className="block rounded-b-xl bg-[#132843] py-3 text-center text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#0e1e33]"
                        >
                          DETAYLARI GÖR
                        </Link>
                      </article>
                    )
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-[#132843] hover:bg-gray-50 disabled:opacity-40 sm:px-4 sm:py-2.5 sm:text-sm dark:border-white/10 dark:bg-[#1a2d45] dark:text-[#e7edf4] dark:hover:bg-white/10"
                    >
                      ← Önceki
                    </button>

                    {pageWindow.map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={classNames(
                          'rounded-lg px-2.5 py-2 text-xs font-medium transition-all sm:px-4 sm:py-2.5 sm:text-sm',
                          currentPage === page
                            ? 'bg-[#132843] text-white shadow-md'
                            : 'border border-gray-200 bg-white text-[#132843] hover:bg-gray-50 dark:border-white/10 dark:bg-[#1a2d45] dark:text-[#e7edf4] dark:hover:bg-white/10',
                        )}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-[#132843] hover:bg-gray-50 disabled:opacity-40 sm:px-4 sm:py-2.5 sm:text-sm dark:border-white/10 dark:bg-[#1a2d45] dark:text-[#e7edf4] dark:hover:bg-white/10"
                    >
                      Sonraki →
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </section>

      {/* ── Mobile Filter Modal ── */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden">
          <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto bg-white p-5 shadow-2xl dark:bg-[#1a2d45]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#132843] dark:text-[#e7edf4]">Filtreler</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 dark:border-white/10 dark:text-gray-300"
              >
                Kapat
              </button>
            </div>

            <FilterPanel
              sectors={sectors}
              platforms={platforms}
              durations={DURATION_OPTIONS}
              selectedSectors={selectedSectors}
              selectedPlatforms={selectedPlatforms}
              selectedDurations={selectedDurations}
              talentOnly={talentOnly}
              onToggleSector={(value) => toggleItem(value, selectedSectors, setSelectedSectors)}
              onTogglePlatform={(value) =>
                toggleItem(value, selectedPlatforms, setSelectedPlatforms)
              }
              onToggleDuration={(value) =>
                toggleItem(value, selectedDurations, setSelectedDurations)
              }
              onToggleTalent={() => setTalentOnly((prev) => !prev)}
              onClearAll={clearAllFilters}
            />

            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="mt-6 w-full rounded-xl bg-[#132843] px-4 py-3 text-sm font-bold text-white"
            >
              Sonuçları Göster
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
