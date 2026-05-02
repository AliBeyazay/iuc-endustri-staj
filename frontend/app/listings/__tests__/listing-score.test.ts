import { describe, it, expect } from 'vitest'
import { getListingSearchScore, rankListingsBySearch } from '../listing-score'
import { extractSmartSearchIntent, normalizeSearchValue } from '../search-intent'
import type { Listing } from '@/types'

function makeListing(overrides: Partial<Listing> & { id: string }): Listing {
  return {
    title: 'Stajyer',
    company_name: 'Test A.Ş.',
    company_logo_url: null,
    source_url: `https://example.com/${overrides.id}`,
    application_url: null,
    source_platform: 'kariyer',
    em_focus_area: 'diger',
    secondary_em_focus_area: null,
    em_focus_confidence: null,
    internship_type: 'zorunlu',
    company_origin: 'yerli',
    location: 'İstanbul',
    description: '',
    requirements: '',
    application_deadline: null,
    deadline_status: 'unknown',
    is_active: true,
    is_talent_program: false,
    program_type: null,
    duration_weeks: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    search_rank: null,
    ...overrides,
  }
}

function score(listing: Listing, query: string): number {
  const intent = extractSmartSearchIntent(query)
  const normalized = normalizeSearchValue(intent.searchText)
  return getListingSearchScore(listing, intent, normalized)
}

describe('getListingSearchScore', () => {
  it('returns 0 when listing has no match for the query', () => {
    const listing = makeListing({ id: '1', title: 'Depo Operatörü', company_name: 'Xyz Lojistik' })
    expect(score(listing, 'yazilim')).toBe(0)
  })

  it('title match scores higher than no match', () => {
    const matched = makeListing({ id: 'm', title: 'Yazılım Geliştirici Stajyeri' })
    const unmatched = makeListing({ id: 'u', title: 'Muhasebe Asistanı' })
    expect(score(matched, 'yazilim')).toBeGreaterThan(score(unmatched, 'yazilim'))
  })

  it('known company (Arçelik) matched via company key lookup scores higher than generic company', () => {
    const arcelik = makeListing({ id: 'a', company_name: 'Arçelik A.Ş.' })
    const other = makeListing({ id: 'o', company_name: 'Xyz Holding' })
    expect(score(arcelik, 'arcelik')).toBeGreaterThan(score(other, 'arcelik'))
  })

  it('sector key match (yazilim_bilisim_teknoloji) adds score vs unrelated sector', () => {
    const tech = makeListing({ id: 't', em_focus_area: 'yazilim_bilisim_teknoloji' })
    const textile = makeListing({ id: 'x', em_focus_area: 'tekstil_moda' })
    // "yazilim" resolves to sectorKey yazilim_bilisim_teknoloji → tech gets +60 sector bonus
    expect(score(tech, 'yazilim')).toBeGreaterThan(score(textile, 'yazilim'))
  })

  it('search_rank signal scales score proportionally', () => {
    // All three listings have the same title so base token scores are identical;
    // search_rank (0–1 → multiplied by 150) is the only differentiator.
    const high = makeListing({ id: 'h', search_rank: 1.0 })
    const low = makeListing({ id: 'l', search_rank: 0.1 })
    const none = makeListing({ id: 'n', search_rank: null })
    expect(score(high, 'stajyer')).toBeGreaterThan(score(low, 'stajyer'))
    expect(score(low, 'stajyer')).toBeGreaterThan(score(none, 'stajyer'))
  })

  it('description-only match contributes a small bonus (capped at 8)', () => {
    const withDesc = makeListing({ id: 'd', title: 'Genel Staj', description: 'python deneyimi gereklidir' })
    const noMatch = makeListing({ id: 'n', title: 'Genel Staj', description: '' })
    const descScore = score(withDesc, 'python')
    const emptyScore = score(noMatch, 'python')
    expect(descScore).toBeGreaterThan(emptyScore)
    // Description bonus is capped at 8, so the delta stays small
    expect(descScore - emptyScore).toBeLessThanOrEqual(8)
  })
})

describe('rankListingsBySearch', () => {
  it('returns original array reference unchanged when query is empty', () => {
    const listings = [makeListing({ id: '1' }), makeListing({ id: '2' })]
    expect(rankListingsBySearch(listings, '')).toEqual(listings)
  })

  it('places title-matching listing before non-matching listing', () => {
    const matched = makeListing({ id: 'match', title: 'Python Backend Stajyeri' })
    const unmatched = makeListing({ id: 'no-match', title: 'İnsan Kaynakları Asistanı' })
    const [first] = rankListingsBySearch([unmatched, matched], 'python')
    expect(first.id).toBe('match')
  })

  it('company key match ranks above title-only match', () => {
    // companyMatch: "Arçelik A.Ş." → company key hit (+140) + phrase hit (+80+55)
    // titleMatch:   "Arçelik Staj" title → companyAndTitle hit (+90) + phrase hit (+95+55)
    const titleMatch = makeListing({ id: 'title', title: 'Arçelik Staj Programı', company_name: 'Bilinmeyen A.Ş.' })
    const companyMatch = makeListing({ id: 'company', title: 'Staj Programı', company_name: 'Arçelik A.Ş.' })
    const noMatch = makeListing({ id: 'none', title: 'Lojistik Operatörü', company_name: 'Genel Lojistik' })
    const [first, , last] = rankListingsBySearch([noMatch, titleMatch, companyMatch], 'arcelik')
    expect(first.id).toBe('company')
    expect(last.id).toBe('none')
  })

  it('breaks score ties by created_at descending — newer listing comes first', () => {
    // Both have identical title 'Stajyer' → identical score for query 'stajyer'
    const older = makeListing({ id: 'old', created_at: '2025-01-01T00:00:00Z' })
    const newer = makeListing({ id: 'new', created_at: '2025-06-01T00:00:00Z' })
    const [first] = rankListingsBySearch([older, newer], 'stajyer')
    expect(first.id).toBe('new')
  })
})
