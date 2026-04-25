import type { RawListing, Listing } from './types'
import { FOCUS_AREA_LABELS, PLATFORM_LABELS } from '@/lib/helpers'

export function normalizeListing(item: RawListing): Listing {
  const primarySectorKey = item.em_focus_area?.replace('ı', 'i') ?? null
  const secondarySectorKey = item.secondary_em_focus_area?.replace('ı', 'i') ?? null

  return {
    id: String(item.id),
    title: item.title,
    company_name: item.company_name,
    company_logo_url: item.company_logo_url ?? null,
    location: item.location ?? null,
    city: item.city ?? null,
    sector: primarySectorKey ? (FOCUS_AREA_LABELS[primarySectorKey] ?? primarySectorKey) : null,
    secondary_sector: secondarySectorKey
      ? (FOCUS_AREA_LABELS[secondarySectorKey] ?? secondarySectorKey)
      : null,
    confidence: typeof item.em_focus_confidence === 'number' ? item.em_focus_confidence : null,
    source_platform: item.source_platform ?? null,
    source_platform_label: item.source_platform
      ? (PLATFORM_LABELS[item.source_platform as keyof typeof PLATFORM_LABELS] ?? item.source_platform)
      : null,
    is_talent_program: Boolean(item.is_talent_program),
    employment_type: item.internship_type ?? null,
    deadline: item.application_deadline ?? null,
    url: item.application_url ?? item.source_url ?? null,
    description: item.description ?? null,
    created_at: item.created_at ?? null,
  }
}

export function cleanSummaryText(raw?: string | null) {
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

export function splitSummarySentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

export function isUsefulSummarySentence(sentence: string) {
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

export function trimSummarySentence(sentence: string) {
  const normalized = sentence.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 150) return normalized

  const shortened = normalized.slice(0, 147)
  const lastSpace = shortened.lastIndexOf(' ')
  return `${shortened.slice(0, lastSpace > 80 ? lastSpace : shortened.length).trim()}...`
}

export function getListingSummary(item: Listing) {
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
