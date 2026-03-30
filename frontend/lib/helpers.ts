import { EMFocusArea, SourcePlatform, FilterState, Listing } from '@/types'

export const FOCUS_AREA_LABELS: Record<string, string> = {
  imalat_metal_makine: 'İmalat, Metal ve Makine',
  otomotiv_yan_sanayi: 'Otomotiv ve Yan Sanayi',
  yazilim_bilisim_teknoloji: 'Yazılım, Bilişim ve Teknoloji',
  hizmet_finans_danismanlik: 'Hizmet, Finans ve Danışmanlık',
  eticaret_perakende_fmcg: 'E-Ticaret, Perakende ve FMCG',
  savunma_havacilik_enerji: 'Savunma, Havacılık ve Enerji',
  gida_kimya_saglik: 'Gıda, Kimya ve Sağlık',
  lojistik_tasimacilik: 'Lojistik ve Taşımacılık',
  tekstil_moda: 'Tekstil ve Moda',
  insaat_yapi_malzemeleri: 'İnşaat ve Yapı Malzemeleri',
  diger: 'Diğer',
}

export const FOCUS_AREA_COLORS: Record<string, string> = {
  imalat_metal_makine: 'bg-[rgba(216,173,67,0.14)] text-[#8f670b] border border-[rgba(216,173,67,0.18)]',
  otomotiv_yan_sanayi: 'bg-[rgba(216,173,67,0.14)] text-[#8f670b] border border-[rgba(216,173,67,0.18)]',
  yazilim_bilisim_teknoloji: 'bg-[rgba(216,173,67,0.14)] text-[#8f670b] border border-[rgba(216,173,67,0.18)]',
  hizmet_finans_danismanlik: 'bg-[rgba(216,173,67,0.14)] text-[#8f670b] border border-[rgba(216,173,67,0.18)]',
  eticaret_perakende_fmcg: 'bg-[rgba(216,173,67,0.14)] text-[#8f670b] border border-[rgba(216,173,67,0.18)]',
  savunma_havacilik_enerji: 'bg-[rgba(216,173,67,0.14)] text-[#8f670b] border border-[rgba(216,173,67,0.18)]',
  gida_kimya_saglik: 'bg-[rgba(216,173,67,0.14)] text-[#8f670b] border border-[rgba(216,173,67,0.18)]',
  lojistik_tasimacilik: 'bg-[rgba(216,173,67,0.14)] text-[#8f670b] border border-[rgba(216,173,67,0.18)]',
  tekstil_moda: 'bg-[rgba(216,173,67,0.14)] text-[#8f670b] border border-[rgba(216,173,67,0.18)]',
  insaat_yapi_malzemeleri: 'bg-[rgba(216,173,67,0.14)] text-[#8f670b] border border-[rgba(216,173,67,0.18)]',
  diger: 'bg-[rgba(216,173,67,0.14)] text-[#8f670b] border border-[rgba(216,173,67,0.18)]',
}

export const PLATFORM_LABELS: Record<SourcePlatform, string> = {
  linkedin: 'LinkedIn',
  kariyer: 'Kariyer.net',
  youthall: 'Youthall',
  anbea: 'Anbean Kampüs',
  boomerang: 'Boomerang',
  toptalent: 'TopTalent',
  savunma: 'Savunma Kariyer',
  odtu_kpm: 'ODTU KPM',
  bogazici_km: 'Bogazici Kariyer',
  ytu_orkam: 'YTU ORKAM',
  itu_kariyer: 'İTÜ Kariyer',
}

export const PROGRAM_TYPE_LABELS: Record<string, string> = {
  yaz_staj_programi: 'Yaz Staj Programı',
  kariyer_baslangic: 'Kariyer Başlangıç Programı',
  rotasyon: 'Rotasyon Programı',
  graduate_program: 'Graduate Program',
  akademi_bootcamp: 'Akademi / Bootcamp',
}

export const FOCUS_AREA_LIST: { value: EMFocusArea; label: string }[] = [
  { value: 'imalat_metal_makine', label: 'İmalat, Metal ve Makine' },
  { value: 'otomotiv_yan_sanayi', label: 'Otomotiv ve Yan Sanayi' },
  { value: 'yazilim_bilisim_teknoloji', label: 'Yazılım, Bilişim ve Teknoloji' },
  { value: 'hizmet_finans_danismanlik', label: 'Hizmet, Finans ve Danışmanlık' },
  { value: 'eticaret_perakende_fmcg', label: 'E-Ticaret, Perakende ve FMCG' },
  { value: 'savunma_havacilik_enerji', label: 'Savunma, Havacılık ve Enerji' },
  { value: 'gida_kimya_saglik', label: 'Gıda, Kimya ve Sağlık' },
  { value: 'lojistik_tasimacilik', label: 'Lojistik ve Taşımacılık' },
  { value: 'tekstil_moda', label: 'Tekstil ve Moda' },
  { value: 'insaat_yapi_malzemeleri', label: 'İnşaat ve Yapı Malzemeleri' },
]

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-green-100 text-green-800',
  'bg-amber-100 text-amber-900',
  'bg-purple-100 text-purple-800',
  'bg-teal-100 text-teal-800',
  'bg-rose-100 text-rose-800',
  'bg-orange-100 text-orange-800',
  'bg-slate-100 text-slate-700',
]

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function timeAgoTurkish(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'Az önce'
  if (diff < 3600) return `${Math.floor(diff / 60)} dakika önce`
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`
  if (diff < 2592000) return `${Math.floor(diff / 604800)} hafta önce`
  return `${Math.floor(diff / 2592000)} ay önce`
}

export function daysUntilDeadline(deadlineStr: string | null): number | null {
  if (!deadlineStr) return null
  const diff = Math.ceil((new Date(deadlineStr).getTime() - Date.now()) / 86400000)
  return diff
}

export function formatDateTurkish(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function formatListingDescription(raw: string): string[] {
  if (!raw) return []

  // Decode HTML entities
  let text = raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')

  // Remove scraped UI artifacts
  text = text
    .replace(/\bShow more\b/gi, '')
    .replace(/\bShow less\b/gi, '')
    .replace(/\bDaha fazla göster\b/gi, '')
    .replace(/\bDaha az göster\b/gi, '')
    .replace(/\bDevamını oku\b/gi, '')
    .replace(/\bDevamını gör\b/gi, '')

  text = text
    .replace(/\s+/g, ' ')
    .replace(/\s([:;,.!?])/g, '$1')
    .trim()

  const noisePatterns = [
    /youthall ana?sayfa.*?(?=rotani|hemen basvur|bu programda|$)/i,
    /youthall home companies jobs events privileges academy blog youth login sign up for employers.*?(?=join|talent nest|which profile|location:|type of contract|$)/i,
    /anbean kampus.*?(?=ilan hakkinda|hakkinda|is tanimi|rotani|bu programda|$)/i,
    /boomerang.*?anasayfa.*?(?=program hakkinda|hemen basvur|duzenleyen|$)/i,
    /sirketler ilanlar etkinlikler.*?(?=rotani|hemen basvur|bu programda|$)/i,
    /kariyer etkinlikleri genc yetenek programlari kulup etkinlikleri/gi,
    /premium ile sana ozel.*?(?=rotani|hemen basvur|bu programda|$)/i,
    /uye(ligi)? hemen baslat.*?(?=rotani|hemen basvur|bu programda|$)/i,
    /ucretsiz kayit ol.*?(?=rotani|hemen basvur|bu programda|$)/i,
    /demo talep et.*?(?=rotani|hemen basvur|bu programda|$)/i,
    /blog kullanici girisi kayit ol/i,
    /okullar ogrenci kulupleri.*?bilgi al\./i,
    /lise(ler)? farkli liseleri kesfet.*?daha yakindan tani\./i,
    /giris yap kayit ol/i,
    /turkce ingilizce/gi,
    /hemen uye ol.*$/i,
    /iletisim \[email protected\].*$/i,
    /cerez politikasi.*$/i,
    /tum haklari saklidir.*$/i,
    /one cikan blog icerikleri.*$/i,
    /one cikan ilanlar.*$/i,
    /home companies jobs events privileges academy blog youth login sign up for employers/gi,
    /turkish english youthall premium.*?(?=join|talent|which profile|location:|type of contract|$)/i,
    /schools okullar ogrenci kulupleri.*?(?=join|talent|which profile|location:|type of contract|$)/i,
    /universiteler turkiye ve dunyadaki universiteler.*?(?=join|talent|which profile|location:|type of contract|$)/i,
  ]

  for (const pattern of noisePatterns) {
    text = text.replace(pattern, ' ')
  }

  const relevantStarts = [
    /join\s+nestle\s+team\s+and\s+be\s+a\s+force\s+for\s+good/i,
    /talent\s+nest\s+is\s+now\s+accepting\s+applications/i,
    /which\s+profile\s+are\s+we\s+looking\s+for\?/i,
    /who\s+are\s+we\s+looking\s+for\?/i,
    /location:\s*[a-zçğıöşü]/i,
    /type of contract:\s*[a-z]/i,
    /ilan hakkinda/i,
    /program hakkinda/i,
    /is tanimi/i,
    /kimler basvurabilir/i,
  ]

  const startIndexes = relevantStarts
    .map((pattern) => text.search(pattern))
    .filter((index) => index >= 0)

  if (startIndexes.length > 0) {
    const bestIndex = Math.min(...startIndexes)
    if (bestIndex > 180) {
      text = text.slice(bestIndex).trim()
    }
  }

  const sectionTitles = [
    'Location',
    'Type of contract',
    'Which profile are we looking for?',
    'Who are we looking for?',
    'İlan Hakkında',
    'Hakkında',
    'İş Tanımı',
    'Başvuru Koşulları',
    'Sana Neler Sunuyoruz',
    'Başvuru Sürecinde Seni Neler Bekliyor',
    'Kimler Başvurabilir',
    'Program Hakkında',
    'Seçim Süreci & Takvim',
  ]

  for (const title of sectionTitles) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    text = text.replace(new RegExp(`\\s*${escaped}\\s*`, 'gi'), `\n\n${title}\n`)
  }

  text = text
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block, index, all) => all.indexOf(block) === index)

  const cleanedBlocks = blocks.flatMap((block) => {
    if (block.length <= 200) return [block]

    return block
      .replace(/(\d+\s*[.)-]\s+)/g, '\n$1')
      .replace(
        /\s+(?=(Kimler Başvurabilir|Başvuru Süreci|Başvuru Dönemi|Staj Dönemi|Genel Yetenek Testi|Video Mülakat|Mülakat|Teklif|Program Hakkında|Seçim Süreci|Peki seni neler bekliyor|Senin de başvurunu bekliyoruz))/gi,
        '\n'
      )
      .replace(/([.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9])/g, '$1\n')
      .split('\n')
      .map((part) => part.trim())
      .filter(Boolean)
      .reduce<string[]>((parts, part) => {
        const previous = parts[parts.length - 1]
        if (previous && previous.length < 140 && part.length < 140 && !part.match(/^\d+\s*[.)-]/)) {
          parts[parts.length - 1] = `${previous} ${part}`
        } else {
          parts.push(part)
        }
        return parts
      }, [])
  })

  if (cleanedBlocks.length > 0) {
    return cleanedBlocks.slice(0, 20)
  }

  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 10)
}

export function getDeadlineDisplay(listing: Listing): {
  label: string
  color: 'red' | 'orange' | 'gray' | 'blue' | null
} {
  const { application_deadline, deadline_status } = listing

  if (deadline_status === 'upcoming') {
    return { label: 'Başvurular yakında açılacak', color: 'blue' }
  }
  if (deadline_status === 'unknown' || !application_deadline) {
    return { label: 'Tarih belirtilmemiş', color: null }
  }
  if (deadline_status === 'expired') {
    return { label: '', color: null }
  }

  const days = daysUntilDeadline(application_deadline)
  if (days === null || days < 0) return { label: '', color: null }
  if (days === 0) return { label: 'Bugün son gün!', color: 'red' }
  if (days <= 7) return { label: `Son ${days} gün`, color: 'red' }
  if (days <= 21) return { label: `Son ${days} gün`, color: 'orange' }
  return { label: `Son ${days} gün`, color: 'gray' }
}

export function buildQueryString(filters: Partial<FilterState>): string {
  const params = new URLSearchParams()

  if (filters.search) params.set('search', filters.search)
  if (filters.ordering) params.set('ordering', filters.ordering)
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))
  if (filters.is_talent_program) params.set('is_talent_program', 'true')

  filters.em_focus_area?.forEach((v) => params.append('em_focus_area', v))
  filters.internship_type?.forEach((v) => params.append('internship_type', v))
  filters.company_origin?.forEach((v) => params.append('company_origin', v))
  filters.source_platform?.forEach((v) => params.append('source_platform', v))
  filters.duration_bucket?.forEach((v) => params.append('duration_bucket', v))

  return params.toString()
}
