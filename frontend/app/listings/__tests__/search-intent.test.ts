import { describe, it, expect } from 'vitest'
import {
  normalizeSearchValue,
  tokenizeNormalizedSearchValue,
  extractSmartSearchIntent,
} from '../search-intent'

describe('normalizeSearchValue', () => {
  it('converts Turkish characters to ASCII equivalents', () => {
    expect(normalizeSearchValue('İstanbul')).toBe('istanbul')
    expect(normalizeSearchValue('Yazılım')).toBe('yazilim')
    expect(normalizeSearchValue('Şişli')).toBe('sisli')
    expect(normalizeSearchValue('Güngören')).toBe('gungoren')
    expect(normalizeSearchValue('Arçelik')).toBe('arcelik')
  })

  it('lowercases ASCII input', () => {
    expect(normalizeSearchValue('ANKARA')).toBe('ankara')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeSearchValue('  arama  ')).toBe('arama')
  })

  it('returns empty string unchanged', () => {
    expect(normalizeSearchValue('')).toBe('')
  })
})

describe('tokenizeNormalizedSearchValue', () => {
  it('splits on whitespace', () => {
    expect(tokenizeNormalizedSearchValue('yazilim staj')).toEqual(['yazilim', 'staj'])
  })

  it('normalizes Turkish characters before tokenizing', () => {
    expect(tokenizeNormalizedSearchValue('Yazılım Staj')).toEqual(['yazilim', 'staj'])
  })

  it('filters tokens shorter than 2 characters', () => {
    const result = tokenizeNormalizedSearchValue('a b cd ef')
    expect(result).toContain('cd')
    expect(result).toContain('ef')
    expect(result).not.toContain('a')
    expect(result).not.toContain('b')
  })

  it('splits on non-alphanumeric separators', () => {
    const result = tokenizeNormalizedSearchValue('kariyer.net')
    expect(result).toContain('kariyer')
    expect(result).toContain('net')
  })

  it('returns empty array for blank input', () => {
    expect(tokenizeNormalizedSearchValue('')).toEqual([])
  })
})

describe('extractSmartSearchIntent', () => {
  it('returns empty result for empty query', () => {
    const result = extractSmartSearchIntent('')
    expect(result.sectorKeys).toEqual([])
    expect(result.platformKeys).toEqual([])
    expect(result.companyKeys).toEqual([])
    expect(result.rawTokens).toEqual([])
    expect(result.searchText).toBe('')
  })

  it('detects platform key for "linkedin"', () => {
    const { platformKeys, sectorKeys, companyKeys } = extractSmartSearchIntent('linkedin')
    expect(platformKeys).toContain('linkedin')
    expect(sectorKeys).toEqual([])
    expect(companyKeys).toEqual([])
  })

  it('detects sector key for "yazilim" via partial label match', () => {
    const { sectorKeys } = extractSmartSearchIntent('yazilim')
    expect(sectorKeys).toContain('yazilim_bilisim_teknoloji')
  })

  it('detects company key for "toyota"', () => {
    const { companyKeys, sectorKeys, platformKeys } = extractSmartSearchIntent('toyota')
    expect(companyKeys).toContain('toyota')
    expect(sectorKeys).toEqual([])
    expect(platformKeys).toEqual([])
  })

  it('detects company via alias "thy" → turk_hava_yollari', () => {
    const { companyKeys } = extractSmartSearchIntent('thy')
    expect(companyKeys).toContain('turk_hava_yollari')
  })

  it('detects platform via alias "kariyer.net"', () => {
    const { platformKeys } = extractSmartSearchIntent('kariyer.net')
    expect(platformKeys).toContain('kariyer')
  })

  it('unrecognized tokens appear in rawTokens', () => {
    const { rawTokens } = extractSmartSearchIntent('istanbul')
    expect(rawTokens).toContain('istanbul')
  })

  it('sector-matched tokens are excluded from searchText (no residual free text)', () => {
    // "yazilim" resolves fully to a sector key — should produce no free-text remainder
    const { searchText } = extractSmartSearchIntent('yazilim')
    expect(searchText).toBe('')
  })

  it('handles mixed query: known company + free-text location', () => {
    const { companyKeys, rawTokens } = extractSmartSearchIntent('arcelik istanbul')
    expect(companyKeys).toContain('arcelik')
    expect(rawTokens).toContain('istanbul')
  })

  it('handles Turkish alias with diacritic: "itü kariyer"', () => {
    const { platformKeys } = extractSmartSearchIntent('itü kariyer')
    expect(platformKeys).toContain('itu_kariyer')
  })
})
