'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { BriefcaseBusiness, Clock3, MapPin, Menu, X } from 'lucide-react'
import UniversityLogo from '@/components/UniversityLogo'

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

type SortOption = 'newest'

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
  'lojistik_tasimacilık': 'Lojistik ve Tasimacilik',
  lojistik_taşimacilik: 'Lojistik ve Tasimacilik',
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
  return '-created_at'
}

function buildListingsApiQuery(params: {
  page: number
  query: string
  selectedSectors: string[]
  selectedPlatforms: string[]
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
  selectedSectors: string[]
  selectedPlatforms: string[]
  talentOnly: boolean
  onToggleSector: (value: string) => void
  onTogglePlatform: (value: string) => void
  onToggleTalent: () => void
  onClearAll: () => void
}

function FilterPanel({
  sectors,
  platforms,
  selectedSectors,
  selectedPlatforms,
  talentOnly,
  onToggleSector,
  onTogglePlatform,
  onToggleTalent,
  onClearAll,
}: FilterPanelProps) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-[#132843]">Sektör</h3>
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
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
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
        <h3 className="mb-3 text-sm font-semibold text-[#132843]">Platform</h3>
        <div className="flex flex-col gap-2">
          {platforms.map((platform) => {
            const active = selectedPlatforms.includes(platform)
            return (
              <button
                key={platform}
                type="button"
                onClick={() => onTogglePlatform(platform)}
                className={classNames(
                  'w-full rounded-full border px-3 py-2 text-left text-xs font-medium transition',
                  active
                    ? 'border-violet-200 bg-violet-50 text-violet-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                )}
              >
                {platform}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-[#132843]">Yetenek Programı</h3>
        <button
          type="button"
          onClick={onToggleTalent}
          className={classNames(
            'w-full rounded-2xl border px-4 py-2 text-left text-sm font-medium transition',
            talentOnly
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
          )}
        >
          Yetenek Programları
        </button>
      </section>

      <button
        type="button"
        onClick={onClearAll}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
      >
        Filtreleri temizle
      </button>
    </div>
  )
}

export default function ListingsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [listings, setListings] = useState<Listing[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [talentOnly, setTalentOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const searchBoxRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    async function loadListings() {
      try {
        setLoading(true)
        setError(null)
        const queryString = buildListingsApiQuery({
          page: currentPage,
          query: debouncedQuery,
          selectedSectors,
          selectedPlatforms,
          talentOnly,
          sortBy,
        })
        const response = await fetch(`/api/listings?${queryString}`, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error('Ilanlar alinamadi.')
        }
        const data = await response.json()
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : []
        const normalizedItems = items.map(normalizeListing)
        setListings(rankListingsBySearch(normalizedItems, debouncedQuery))
        setTotalCount(Array.isArray(data) ? items.length : Number(data?.count ?? items.length))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Beklenmeyen hata oluştu.')
      } finally {
        setLoading(false)
      }
    }

    void loadListings()
  }, [currentPage, debouncedQuery, selectedPlatforms, selectedSectors, sortBy, talentOnly])

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
  }, [debouncedQuery, selectedPlatforms, selectedSectors, sortBy, talentOnly])

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
    selectedSectors.length + selectedPlatforms.length + (talentOnly ? 1 : 0)

  const userInitials =
    session?.user?.name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'AY'

  const summaryCards = [
    { label: 'Toplam sonuç', value: totalCount },
    { label: 'Seçili sektör', value: selectedSectors.length },
    { label: 'Yakın son başvuru', value: urgentCount },
  ]

  return (
    <div className="campus-shell flex min-h-screen flex-col pb-24 lg:pb-0">
      <nav className="campus-nav sticky top-0 z-50 shrink-0 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/listings" className="flex min-w-0 items-center gap-3">
            <UniversityLogo className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" />
            <div className="min-w-0">
              <span className="campus-brand block text-lg leading-none sm:text-2xl">
                İstanbul Üniversitesi Cerrahpaşa
              </span>
              <p className="hidden text-[10px] uppercase tracking-[0.28em] text-[#f4e3b3]/80 sm:block">
                Endüstri Mühendisliği Staj Platformu
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 sm:flex sm:gap-3">
            {status === 'authenticated' ? (
              <>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="hidden rounded-full border border-[#d8ad43]/35 bg-white/8 px-3 py-2 text-xs font-semibold text-[#f7ecd0] transition-colors hover:bg-white/14 sm:inline-flex"
                >
                  Profil
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="flex h-10 min-w-10 items-center justify-center rounded-full border border-[#d8ad43]/35 bg-[#f1d27e] px-2 text-[10px] font-bold text-[#10223b] shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
                  aria-label="Profil"
                >
                  {userInitials}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="rounded-full border border-white/18 bg-white/8 px-3 py-2 text-xs font-semibold text-[#f7ecd0] transition-colors hover:bg-white/14"
                >
                  Giriş Yap
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/register')}
                  className="rounded-full border border-[#d8ad43]/40 bg-[#f1d27e] px-3 py-2 text-xs font-bold text-[#10223b] shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-px"
                >
                  Kayıt Ol
                </button>
              </>
            )}
          </div>

          <div className="flex items-center sm:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Menuyu kapat' : 'Menuyu ac'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/14 bg-white/8 text-[#f7ecd0] transition-colors hover:bg-white/14"
            >
              {mobileMenuOpen ? <X size={22} strokeWidth={2.2} /> : <Menu size={22} strokeWidth={2.2} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="mt-3 rounded-[28px] border border-[#d8ad43]/18 bg-[#10223b]/98 p-3 shadow-[0_18px_50px_rgba(7,16,28,0.30)] backdrop-blur sm:hidden">
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  router.push('/listings')
                }}
                className="rounded-2xl border border-[#f1d27e]/40 bg-[#f1d27e] px-4 py-3 text-sm font-semibold text-[#10223b]"
              >
                Ilanlar
              </button>

              {status === 'authenticated' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      router.push('/dashboard#saved')
                    }}
                    className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-[#f7ecd0]"
                  >
                    Kaydedilenler
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      router.push('/dashboard#profile')
                    }}
                    className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-[#f7ecd0]"
                  >
                    Profil
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      router.push('/login')
                    }}
                    className="rounded-2xl border border-white/14 bg-white/8 px-4 py-3 text-sm font-semibold text-[#f7ecd0]"
                  >
                    Giriş Yap
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      router.push('/register')
                    }}
                    className="rounded-2xl border border-[#d8ad43]/40 bg-[#f1d27e] px-4 py-3 text-sm font-bold text-[#10223b]"
                  >
                    Kayıt Ol
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </nav>

      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="relative z-40 isolate mb-6 overflow-visible rounded-[32px] border border-[#d8ad43]/16 bg-white/72 p-5 shadow-[0_24px_60px_rgba(18,40,67,0.08)] backdrop-blur">
          <div className="grid gap-5 border-b border-[#d8ad43]/12 pb-6 lg:grid-cols-[minmax(0,1.35fr)_360px] lg:items-end">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#8f670b]">IUC Staj Platformu</p>
              <h1 className="campus-heading mt-3 max-w-4xl text-3xl leading-[0.95] text-[#132843] sm:text-4xl lg:text-5xl">
                Endüstri mühendisliği odaklı staj ve yetenek programlarını tek ekranda keşfet.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[#173156]/72 sm:text-base">
                LinkedIn, Youthall, Anbean, TopTalent ve diğer kaynaklardan çekilen ilanları tek
                bir akışta takip et. Önce genel resmi gör, sonra filtrelerle kendi sektörüne ve
                hedeflerine en uygun ilanlara hızla ulaş.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[26px] bg-[#132843] px-4 py-4 text-[#eef3fa] shadow-[0_20px_40px_rgba(10,21,35,0.2)]">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#f0cf7a]/82">
                  Güncel Havuz
                </p>
                <p className="mt-2 text-3xl font-semibold">{loading ? '...' : totalCount}</p>
                <p className="mt-1 text-[11px] text-white/68">Aktif ilan ve program</p>
              </div>
              <div className="rounded-[26px] border border-[#d8ad43]/18 bg-white/70 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#8f670b]/72">
                  Kaynak Çeşitliliği
                </p>
                <p className="mt-2 text-3xl font-semibold text-[#132843]">
                  {platforms.length || '0'}
                </p>
                <p className="mt-1 text-[11px] text-[#173156]/58">Farklı platformdan veri</p>
              </div>
              <div className="rounded-[26px] border border-[#d8ad43]/18 bg-white/70 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#8f670b]/72">
                  Hızlı Eylem
                </p>
                <p className="mt-2 text-base font-semibold text-[#132843]">
                  Filtrele, incele, yönlen
                </p>
                <p className="mt-1 text-[11px] text-[#173156]/58">
                  Detaydan kaynağa anında geç
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#8f670b]">Arama ve Filtreleme</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#132843] sm:text-3xl">
                {dynamicTitle}
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-[#173156]/72">
                Filtrelere göre anında güncellenen ilan görünümü. Sektör, platform ve güven
                skoru birlikte okunabilir olsun diye arama, metrikler ve filtre özeti aynı alanda
                toplandı.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="inline-flex items-center justify-center rounded-2xl border border-[#d8ad43]/20 bg-white px-4 py-2 text-sm font-medium text-[#173156] shadow-sm lg:hidden"
            >
              Filtreler
              {activeFilterCount > 0 && (
                <span className="ml-2 rounded-full bg-[#132843] px-2 py-0.5 text-xs text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-[24px] border border-[#d8ad43]/18 bg-[#fffaf0] px-4 py-3"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-[#8f670b]/72">
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-[#132843]">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="relative z-[90] mt-5 flex flex-col gap-3 lg:flex-row">
            <div className="relative z-[90] flex-1" ref={searchBoxRef}>
              <div className="relative z-[95] flex items-center rounded-[24px] border border-[#d8ad43]/18 bg-white px-4 py-3 shadow-sm ring-0 transition focus-within:border-[#d8ad43]/40 focus-within:ring-2 focus-within:ring-[#f1d27e]/30">
                <span className="mr-3 text-[#173156]/45">⌕</span>
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
                  placeholder="Şirket, pozisyon veya anahtar kelime ara"
                  className="w-full bg-transparent text-sm text-[#132843] outline-none placeholder:text-[#173156]/40"
                />
              </div>

              {showSuggestions && (
                <div className="absolute left-0 top-full z-[94] mt-2 max-h-[320px] w-full overflow-y-auto rounded-[24px] border border-[#d8ad43]/18 bg-white p-2 shadow-[0_24px_60px_rgba(18,40,67,0.18)] sm:max-w-[40rem]">
                  {autocompleteSuggestions.length > 0 && (
                    <div className="mb-2">
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[#173156]/35">
                        Öneriler
                      </p>
                      {autocompleteSuggestions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => submitSuggestion(item)}
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-[#173156] hover:bg-[#fff7e6]"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}

                  {recentSearches.length > 0 && (
                    <div>
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[#173156]/35">
                        Son aramalar
                      </p>
                      {recentSearches.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => submitSuggestion(item)}
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-[#173156] hover:bg-[#fff7e6]"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}

                  {autocompleteSuggestions.length === 0 && recentSearches.length === 0 && (
                    <div className="px-3 py-4 text-sm text-[#173156]/58">
                      Henüz öneri yok. Firma adı, şehir veya pozisyon yaz.
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {(selectedSectors.length > 0 || selectedPlatforms.length > 0 || talentOnly) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {selectedSectors.map((sector) => (
                <button
                  key={sector}
                  type="button"
                  onClick={() => setSelectedSectors(selectedSectors.filter((item) => item !== sector))}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                >
                  {sector} ×
                </button>
              ))}

              {selectedPlatforms.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() =>
                    setSelectedPlatforms(selectedPlatforms.filter((item) => item !== platform))
                  }
                  className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
                >
                  {platform} ×
                </button>
              ))}

              {talentOnly && (
                <button
                  type="button"
                  onClick={() => setTalentOnly(false)}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                >
                  Yetenek Programı ×
                </button>
              )}

              <button
                type="button"
                onClick={clearAllFilters}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700"
              >
                Tümünü temizle
              </button>
            </div>
          )}
        </div>

        <div className="relative z-0 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-6 rounded-[32px] border border-[#d8ad43]/16 bg-white/72 p-5 shadow-[0_24px_60px_rgba(18,40,67,0.08)] backdrop-blur">
              <FilterPanel
                sectors={sectors}
                platforms={platforms}
                selectedSectors={selectedSectors}
                selectedPlatforms={selectedPlatforms}
                talentOnly={talentOnly}
                onToggleSector={(value) => toggleItem(value, selectedSectors, setSelectedSectors)}
                onTogglePlatform={(value) =>
                  toggleItem(value, selectedPlatforms, setSelectedPlatforms)
                }
                onToggleTalent={() => setTalentOnly((prev) => !prev)}
                onClearAll={clearAllFilters}
              />
            </div>
          </aside>

          <main>
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-64 animate-pulse rounded-[32px] border border-[#d8ad43]/16 bg-white/70"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-[32px] border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
                <p className="text-lg font-semibold text-rose-800">Veri yuklenemedi</p>
                <p className="mt-2 text-sm text-rose-700">{error}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Tekrar dene
                </button>
              </div>
            ) : listings.length === 0 ? (
              <div className="rounded-[32px] border border-[#d8ad43]/16 bg-white/72 p-10 text-center shadow-sm">
                <p className="text-lg font-semibold text-[#132843]">Sonuç bulunamadı</p>
                <p className="mt-2 text-sm text-[#173156]/72">
                  Seçtiğin filtre kombinasyonu fazla dar olabilir. Bazı filtreleri kaldır.
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-4 rounded-2xl bg-[#132843] px-4 py-2 text-sm font-medium text-white"
                >
                  Filtreleri temizle
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-col gap-2 rounded-[24px] border border-[#d8ad43]/12 bg-white/60 px-4 py-3 text-sm text-[#173156]/72 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    {visibleRange.start}-{visibleRange.end} arası gösteriliyor
                  </p>
                  <p>
                    Sayfa {currentPage} / {totalPages}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {listings.map((item) => {
                  return (
                    <article
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/listings/${item.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          router.push(`/listings/${item.id}`)
                        }
                      }}
                      className="group cursor-pointer rounded-[28px] border border-[#e9edf5] bg-white px-4 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_22px_46px_rgba(15,23,42,0.1)]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-[22px] border border-[#dde4f0] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
                          {item.company_logo_url ? (
                            <img
                              src={item.company_logo_url}
                              alt={item.company_name}
                              className="h-12 w-12 object-contain"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div
                              className={classNames(
                                'flex h-[56px] w-[56px] items-center justify-center rounded-[18px] border bg-gradient-to-br text-[15px] font-semibold tracking-[0.08em] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
                                getCompanyMonogramStyle(item.company_name),
                              )}
                            >
                              {getCompanyBadgeText(item.company_name)}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-[#173156]/58">{item.company_name}</p>
                          <h2 className="mt-1 text-[0.98rem] font-semibold leading-[1.14] tracking-[-0.015em] text-[#132843] sm:text-[1.05rem]">
                            {item.title}
                          </h2>
                        </div>
                      </div>

                      <p className="mt-4 line-clamp-2 text-[0.9rem] leading-6 text-[#173156]/76">
                        {getListingSummary(item)}
                      </p>

                      <div className="mt-4 border-t border-dashed border-[#e1e6ef]" />

                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-[15px] border border-[#e7ebf3] bg-[#f8fafc] px-3 py-1.5 text-[12px] font-medium text-[#4a5c76] shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
                          <BriefcaseBusiness size={16} strokeWidth={2} />
                          {getEmploymentTypeLabel(item.employment_type)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-[15px] border border-[#e7ebf3] bg-[#f8fafc] px-3 py-1.5 text-[12px] font-medium text-[#4a5c76] shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
                          <Clock3 size={16} strokeWidth={2} />
                          {formatDate(item.deadline)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-[15px] border border-[#e7ebf3] bg-[#f8fafc] px-3 py-1.5 text-[12px] font-medium text-[#4a5c76] shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
                          <MapPin size={16} strokeWidth={2} />
                          {getWorkModelLabel(item)}
                        </span>
                      </div>
                    </article>
                  )
                })}
                </div>

                {totalPages > 1 && (
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      className="rounded-2xl border border-[#d8ad43]/20 bg-white px-4 py-2 text-sm font-medium text-[#173156] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Önceki
                    </button>

                    {pageWindow.map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={classNames(
                          'rounded-2xl px-4 py-2 text-sm font-medium transition',
                          currentPage === page
                            ? 'bg-[#132843] text-white'
                            : 'border border-[#d8ad43]/20 bg-white text-[#173156]',
                        )}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-2xl border border-[#d8ad43]/20 bg-white px-4 py-2 text-sm font-medium text-[#173156] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Sonraki
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden">
          <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#132843]">Filtreler</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-gray-700"
              >
                Kapat
              </button>
            </div>

            <FilterPanel
              sectors={sectors}
              platforms={platforms}
              selectedSectors={selectedSectors}
              selectedPlatforms={selectedPlatforms}
              talentOnly={talentOnly}
              onToggleSector={(value) => toggleItem(value, selectedSectors, setSelectedSectors)}
              onTogglePlatform={(value) =>
                toggleItem(value, selectedPlatforms, setSelectedPlatforms)
              }
              onToggleTalent={() => setTalentOnly((prev) => !prev)}
              onClearAll={clearAllFilters}
            />

            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="mt-6 w-full rounded-2xl bg-[#132843] px-4 py-3 text-sm font-medium text-white"
            >
              Sonuçları Göster
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
