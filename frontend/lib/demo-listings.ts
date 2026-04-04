import { FilterState, Listing, PaginatedResponse } from '@/types'

const now = new Date().toISOString()

export const DEMO_LISTINGS: Listing[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Üretim Planlama Stajyeri',
    company_name: 'Arçelik',
    company_logo_url: null,
    source_url: 'https://example.com/listings/arcelik-uretim-planlama-stajyeri',
    application_url: 'https://example.com/listings/arcelik-uretim-planlama-stajyeri',
    source_platform: 'linkedin',
    em_focus_area: 'imalat_metal_makine',
    secondary_em_focus_area: null,
    em_focus_confidence: 88,
    internship_type: 'zorunlu',
    company_origin: 'yerli',
    location: 'İstanbul',
    description: 'Üretim planlama, kapasite analizi ve süreç iyileştirme çalışmalarına destek verecek stajyer aranıyor.',
    requirements: 'Endüstri Mühendisliği öğrencisi olmak, Excel bilgisi, analitik düşünce.',
    application_deadline: '2026-04-02',
    deadline_status: 'normal',
    is_active: true,
    is_talent_program: false,
    program_type: null,
    duration_weeks: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'Supply Chain Intern',
    company_name: 'Unilever',
    company_logo_url: null,
    source_url: 'https://example.com/listings/unilever-supply-chain-intern',
    application_url: 'https://example.com/listings/unilever-supply-chain-intern',
    source_platform: 'youthall',
    em_focus_area: 'eticaret_perakende_fmcg',
    secondary_em_focus_area: 'lojistik_tasimacilik',
    em_focus_confidence: 84,
    internship_type: 'gonullu',
    company_origin: 'yabanci',
    location: 'İstanbul Hybrid',
    description: 'Forecast, inventory ve service level metrikleri üzerinde çalışacak supply chain intern aranıyor.',
    requirements: 'PowerPoint ve Excel bilgisi, iyi seviyede İngilizce.',
    application_deadline: '2026-03-27',
    deadline_status: 'normal',
    is_active: true,
    is_talent_program: true,
    program_type: 'yaz_staj_programi',
    duration_weeks: 10,
    created_at: now,
    updated_at: now,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    title: 'Data Analytics Internship',
    company_name: 'Ford Otosan',
    company_logo_url: null,
    source_url: 'https://example.com/listings/ford-otosan-data-analytics-internship',
    application_url: 'https://example.com/listings/ford-otosan-data-analytics-internship',
    source_platform: 'linkedin',
    em_focus_area: 'otomotiv_yan_sanayi',
    secondary_em_focus_area: 'yazilim_bilisim_teknoloji',
    em_focus_confidence: 78,
    internship_type: 'zorunlu',
    company_origin: 'yerli',
    location: 'Kocaeli',
    description: 'Operasyonel verilerin analizi ve dashboard oluşturma süreçlerine destek olacak stajyer aranıyor.',
    requirements: 'SQL veya Python bilgisi tercih sebebi.',
    application_deadline: '2026-03-21',
    deadline_status: 'urgent',
    is_active: true,
    is_talent_program: false,
    program_type: null,
    duration_weeks: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    title: 'Process Improvement Intern',
    company_name: 'Trendyol',
    company_logo_url: null,
    source_url: 'https://example.com/listings/trendyol-process-improvement-intern',
    application_url: 'https://example.com/listings/trendyol-process-improvement-intern',
    source_platform: 'boomerang',
    em_focus_area: 'yazilim_bilisim_teknoloji',
    secondary_em_focus_area: 'eticaret_perakende_fmcg',
    em_focus_confidence: 81,
    internship_type: 'gonullu',
    company_origin: 'yerli',
    location: 'İstanbul',
    description: 'Operasyon süreçlerini analiz edecek, KPI raporlarına destek verecek stajyer aranıyor.',
    requirements: 'Süreç yönetimi ve veri analitiği ilgisi.',
    application_deadline: '2026-04-04',
    deadline_status: 'normal',
    is_active: true,
    is_talent_program: true,
    program_type: 'kariyer_baslangic',
    duration_weeks: 8,
    created_at: now,
    updated_at: now,
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    title: 'Logistics Planning Intern',
    company_name: 'Borusan Lojistik',
    company_logo_url: null,
    source_url: 'https://example.com/listings/borusan-logistics-planning-intern',
    application_url: 'https://example.com/listings/borusan-logistics-planning-intern',
    source_platform: 'anbea',
    em_focus_area: 'lojistik_tasimacilik',
    secondary_em_focus_area: 'imalat_metal_makine',
    em_focus_confidence: 86,
    internship_type: 'zorunlu',
    company_origin: 'yerli',
    location: 'İstanbul',
    description: 'Dağıtım planlama ve rota optimizasyon ekiplerine destek verecek stajyer aranıyor.',
    requirements: 'Analitik düşünme ve ekip çalışmasına yatkınlık.',
    application_deadline: '2026-03-24',
    deadline_status: 'normal',
    is_active: true,
    is_talent_program: false,
    program_type: null,
    duration_weeks: null,
    created_at: now,
    updated_at: now,
  },
]

const PAGE_SIZE = 20

export function getDemoListingById(id: string): Listing | undefined {
  return DEMO_LISTINGS.find((listing) => listing.id === id)
}

export function getDemoListings(filters: Partial<FilterState>): PaginatedResponse<Listing> {
  let results = [...DEMO_LISTINGS]

  if (filters.search) {
    const needle = filters.search.toLowerCase()
    results = results.filter((listing) =>
      [
        listing.title,
        listing.company_name,
        listing.location,
        listing.description,
      ].some((field) => field.toLowerCase().includes(needle))
    )
  }

  if (filters.em_focus_area?.length) {
    results = results.filter((listing) => filters.em_focus_area?.includes(listing.em_focus_area))
  }
  if (filters.internship_type?.length) {
    results = results.filter((listing) => filters.internship_type?.includes(listing.internship_type))
  }
  if (filters.company_origin?.length) {
    results = results.filter((listing) => filters.company_origin?.includes(listing.company_origin))
  }
  if (filters.source_platform?.length) {
    results = results.filter((listing) => filters.source_platform?.includes(listing.source_platform))
  }
  if (filters.is_talent_program) {
    results = results.filter((listing) => listing.is_talent_program)
  }

  switch (filters.ordering) {
    case 'application_deadline':
      results.sort((a, b) => (a.application_deadline ?? '').localeCompare(b.application_deadline ?? ''))
      break
    case 'company_name':
      results.sort((a, b) => a.company_name.localeCompare(b.company_name))
      break
    default:
      results.sort((a, b) => b.created_at.localeCompare(a.created_at))
      break
  }

  const page = filters.page ?? 1
  const start = (page - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  const paged = results.slice(start, end)

  return {
    count: results.length,
    next: end < results.length ? `demo://listings?page=${page + 1}` : null,
    previous: page > 1 ? `demo://listings?page=${page - 1}` : null,
    results: paged,
  }
}
