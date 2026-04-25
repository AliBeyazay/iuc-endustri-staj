'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { BriefcaseBusiness, Clock3, MapPin, History } from 'lucide-react'
import useSWR from 'swr'
import PublicSiteHeader from '@/components/PublicSiteHeader'
import { useRecentlyViewed } from '@/hooks'
import { buildDefaultListingsSWRKey } from './listings-query'
import type { ListingsResponse, RawListing, Listing } from './types'
import {
  extractSmartSearchIntent,
  normalizeSearchValue,
} from './search-intent'
import { FOCUS_AREA_LABELS, PLATFORM_LABELS } from '@/lib/helpers'
import { rankListingsBySearch } from './listing-score'
import { normalizeListing, getListingSummary } from './listing-normalizer'

type SortOption = 'newest' | 'deadline' | 'company' | 'popular' | 'top_rated'
type SectorOption = { label: string; value: string; icon: string }

const RECENT_SEARCHES_KEY = 'iuc_listings_recent_searches'
const ITEMS_PER_PAGE = 20

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

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'newest', label: 'En yeni' },
  { value: 'deadline', label: 'Deadline yakindan uzağa' },
  { value: 'company', label: 'Sirket A-Z' },
  { value: 'popular', label: 'Populerlik (kaydetme)' },
  { value: 'top_rated', label: 'En yuksek puan' },
]

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
    const sectorKey = Object.entries(FOCUS_AREA_LABELS).find(
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
    const platformKey = Object.entries(PLATFORM_LABELS).find(
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

type FilterPanelProps = {
  sectors: SectorOption[]
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
        <h3 className="mb-3 text-sm font-semibold text-[#132843] dark:text-[#e7edf4]">Sektör</h3>
        <div className="filter-scrollbar max-h-[360px] overflow-y-scroll pr-1">
          <div className="flex flex-col gap-2">
          {sectors.map((sector) => {
            const active = selectedSectors.includes(sector.value)
            return (
              <button
                key={sector.value}
                type="button"
                onClick={() => onToggleSector(sector.value)}
                className={classNames(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all',
                  active
                    ? 'border-[#132843] bg-[#132843] text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10',
                )}
              >
                <span className="text-lg">{sector.icon}</span>
                <span>{sector.label}</span>
              </button>
            )
          })}
          </div>
        </div>
      </section>

      <div className="pt-1 [&>h3]:hidden">
        <h3 className="mb-3 text-sm font-semibold text-[#132843] dark:text-[#e7edf4]">Yetenek Programı</h3>
        <button
          type="button"
          onClick={onToggleTalent}
          className={classNames(
            'w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all',
            talentOnly
              ? 'border-[#132843] bg-[#132843] text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10',
          )}
        >
          Yetenek Programları
        </button>
      </div>

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

type ListingsPageClientProps = {
  initialData: ListingsResponse | null
  initialSWRKey: string
}

export default function ListingsPageClient({
  initialData,
  initialSWRKey,
}: ListingsPageClientProps) {
  const { data: session, status } = useSession()

  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get('q') || '')
  const [selectedSectors, setSelectedSectors] = useState<string[]>(searchParams.getAll('sector'))
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(searchParams.getAll('platform'))
  const [talentOnly, setTalentOnly] = useState(searchParams.get('talent') === 'true')
  const [sortBy, setSortBy] = useState<SortOption>((searchParams.get('sort') as SortOption) || 'newest')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1)

  const searchBoxRef = useRef<HTMLDivElement>(null)
  const { recentItems, clearAll: clearRecentlyViewed } = useRecentlyViewed()

  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (sortBy !== 'newest') params.set('sort', sortBy)
    if (currentPage > 1) params.set('page', String(currentPage))
    if (talentOnly) params.set('talent', 'true')
    selectedSectors.forEach((s) => params.append('sector', s))
    selectedPlatforms.forEach((p) => params.append('platform', p))

    const newUrl = `${pathname}?${params.toString()}`
    if (searchParams.toString() !== params.toString()) {
      router.replace(newUrl, { scroll: false })
    }
  }, [
    debouncedQuery,
    sortBy,
    currentPage,
    talentOnly,
    selectedSectors,
    selectedPlatforms,
    pathname,
    router,
    searchParams,
  ])
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

  const isDefaultState = useMemo(
    () =>
      currentPage === 1 &&
      !debouncedQuery &&
      selectedSectors.length === 0 &&
      selectedPlatforms.length === 0 &&
      !talentOnly &&
      sortBy === 'newest',
    [
      currentPage,
      debouncedQuery,
      selectedPlatforms.length,
      selectedSectors.length,
      sortBy,
      talentOnly,
    ],
  )

  const swrKey = useMemo(() => {
    if (isDefaultState) {
      return initialSWRKey || buildDefaultListingsSWRKey()
    }

    const queryString = buildListingsApiQuery({
      page: currentPage,
      query: debouncedQuery,
      selectedSectors,
      selectedPlatforms,
      talentOnly,
      sortBy,
    })
    return `/api/listings?${queryString}`
  }, [
    currentPage,
    debouncedQuery,
    initialSWRKey,
    isDefaultState,
    selectedPlatforms,
    selectedSectors,
    sortBy,
    talentOnly,
  ])

  const listingsFetcher = useCallback(async (url: string): Promise<ListingsResponse> => {
    const response = await fetch(url)
    if (!response.ok) throw new Error('İlanlar alınamadı.')
    return response.json()
  }, [])

  const shouldUseInitialData = Boolean(initialData) && swrKey === initialSWRKey

  const { data: swrData, error: swrError, isLoading: loading } = useSWR<ListingsResponse>(
    swrKey,
    listingsFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      keepPreviousData: true,
      fallbackData: shouldUseInitialData ? initialData ?? undefined : undefined,
      revalidateOnMount: shouldUseInitialData ? false : undefined,
      revalidateIfStale: shouldUseInitialData ? false : undefined,
    },
  )

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

  const platformOptions = useMemo(
    () => (platforms.includes('PythianGo') ? platforms : [...platforms, 'PythianGo']),
    [platforms],
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

    platformOptions.forEach((platform) => {
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
  }, [listings, platformOptions, query])

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
      <PublicSiteHeader activePath="/listings" />

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
          <div className="relative z-0 mx-auto mt-8 max-w-2xl" ref={searchBoxRef}>
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
              <div className="absolute left-0 top-full z-10 mt-2 max-h-[320px] w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#1a2d45]">
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
      {(selectedSectors.length > 0 || selectedPlatforms.length > 0 || talentOnly) && (
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
                {platformOptions.map((platform) => {
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
              sectors={SIDEBAR_SECTORS}
              platforms={platformOptions}
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
