import { describe, it, expect } from 'vitest'
import { getListingSearchScore, rankListingsBySearch } from './listing-score'
import { extractSmartSearchIntent } from './search-intent'
import { Listing } from '@/types'

const mockListings: Listing[] = [
  {
    id: '1',
    title: 'Frontend Developer Stajyeri',
    company_name: 'Aselsan',
    location: 'Ankara',
    description: 'React, Next.js bilen stajyer aranıyor.',
    em_focus_area: 'Yazılım, Bilişim ve Teknoloji',
    source_platform: 'kariyer',
    is_talent_program: false,
    internship_type: 'zorunlu',
    company_origin: 'yerli',
    company_logo_url: null,
    source_url: 'https://kariyer.net',
    created_at: '2023-01-01T10:00:00Z',
    updated_at: '2023-01-01T10:00:00Z',
    is_active: true,
  },
  {
    id: '2',
    title: 'Üretim Mühendisliği Stajyeri',
    company_name: 'Ford Otosan',
    location: 'Kocaeli',
    description: 'Üretim bandında görev alacak stajyer.',
    em_focus_area: 'İmalat, Metal ve Makine',
    source_platform: 'youthall',
    is_talent_program: true,
    internship_type: 'gonullu',
    company_origin: 'yerli',
    company_logo_url: null,
    source_url: 'https://youthall.com',
    created_at: '2023-01-02T10:00:00Z',
    updated_at: '2023-01-02T10:00:00Z',
    is_active: true,
  },
  {
    id: '3',
    title: 'Yazılım Stajyeri (Backend)',
    company_name: 'Trendyol',
    location: 'İstanbul',
    description: 'Golang ve Java bilen stajyer.',
    em_focus_area: 'Yazılım, Bilişim ve Teknoloji',
    source_platform: 'linkedin',
    is_talent_program: false,
    internship_type: 'belirsiz',
    company_origin: 'yerli',
    company_logo_url: null,
    source_url: 'https://linkedin.com',
    created_at: '2023-01-03T10:00:00Z',
    updated_at: '2023-01-03T10:00:00Z',
    is_active: true,
  }
]

describe('listing-score.ts tests', () => {
  it('should score exact company match higher than title token match', () => {
    const query = 'Aselsan'
    const intent = extractSmartSearchIntent(query)
    const aselsanScore = getListingSearchScore(mockListings[0], intent, query.toLowerCase())
    const trendyolScore = getListingSearchScore(mockListings[2], intent, query.toLowerCase())

    expect(aselsanScore).toBeGreaterThan(0)
    expect(aselsanScore).toBeGreaterThan(trendyolScore)
    expect(trendyolScore).toBe(0)
  })

  it('should rank listings correctly based on query', () => {
    const ranked = rankListingsBySearch(mockListings, 'Trendyol Yazılım')
    
    // Trendyol should be first because it matches both company name and title token
    expect(ranked[0].company_name).toBe('Trendyol')
    
    // Aselsan should be second because it matches 'Yazılım' in em_focus_area (Yazılım, Bilişim...)
    expect(ranked[1].company_name).toBe('Aselsan')
    
    // Ford Otosan should be last
    expect(ranked[2].company_name).toBe('Ford Otosan')
  })

  it('should return original list if search intent is empty', () => {
    const ranked = rankListingsBySearch(mockListings, '')
    // Without any search intent, the array should be untouched
    // Note: JS sort is in-place, but our function copies the array
    expect(ranked.map(l => l.id)).toEqual(['1', '2', '3'])
  })

  it('should sort by creation date descending if scores are identical', () => {
    const identicalScoreListings = [
      { ...mockListings[0], id: 'a', created_at: '2023-01-01T10:00:00Z' },
      { ...mockListings[0], id: 'b', created_at: '2023-01-05T10:00:00Z' },
      { ...mockListings[0], id: 'c', created_at: '2023-01-03T10:00:00Z' },
    ]

    const ranked = rankListingsBySearch(identicalScoreListings, 'Aselsan')
    // Should be b, c, a because b is newest
    expect(ranked.map(l => l.id)).toEqual(['b', 'c', 'a'])
  })

  it('should score platform matches correctly', () => {
    const query = 'Kariyer'
    const intent = extractSmartSearchIntent(query)
    const score = getListingSearchScore(mockListings[0], intent, query.toLowerCase()) // Aselsan uses 'kariyer' platform
    expect(score).toBeGreaterThan(0)
  })
})
