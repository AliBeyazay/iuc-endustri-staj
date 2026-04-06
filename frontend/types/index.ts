export type EMFocusArea =
  | 'imalat_metal_makine'
  | 'otomotiv_yan_sanayi'
  | 'yazilim_bilisim_teknoloji'
  | 'hizmet_finans_danismanlik'
  | 'eticaret_perakende_fmcg'
  | 'savunma_havacilik_enerji'
  | 'gida_kimya_saglik'
  | 'lojistik_tasimacilik'
  | 'tekstil_moda'
  | 'insaat_yapi_malzemeleri'
  | 'diger'

export type SourcePlatform =
  | 'linkedin'
  | 'kariyer'
  | 'youthall'
  | 'anbea'
  | 'boomerang'
  | 'toptalent'
  | 'savunma'
  | 'odtu_kpm'
  | 'bogazici_km'
  | 'ytu_orkam'
  | 'itu_kariyer'
  | 'pythiango'

export type InternshipType = 'zorunlu' | 'gonullu' | 'belirsiz'
export type CompanyOrigin = 'yerli' | 'yabanci' | 'belirsiz'
export type DeadlineStatus = 'urgent' | 'normal' | 'unknown' | 'upcoming' | 'expired'
export type DurationBucket = '4_weeks' | '8_weeks' | '12_plus_weeks'

export type TalentProgramType =
  | 'yaz_staj_programi'
  | 'kariyer_baslangic'
  | 'rotasyon'
  | 'graduate_program'
  | 'akademi_bootcamp'

export interface Listing {
  id: string
  title: string
  company_name: string
  company_logo_url: string | null
  source_url: string
  application_url: string | null
  source_platform: SourcePlatform
  em_focus_area: EMFocusArea
  secondary_em_focus_area: EMFocusArea | null
  em_focus_confidence: number | null
  internship_type: InternshipType
  company_origin: CompanyOrigin
  location: string
  description: string
  requirements: string
  application_deadline: string | null
  deadline_status: DeadlineStatus
  is_active: boolean
  is_talent_program: boolean
  program_type: TalentProgramType | null
  duration_weeks: number | null
  homepage_featured_image_url?: string | null
  homepage_featured_summary?: string | null
  created_at: string
  updated_at: string
}

export interface HomepageFeaturedListing {
  id: string
  title: string
  company_name: string
  company_logo_url: string | null
  source_platform: SourcePlatform
  internship_type: InternshipType
  location: string
  application_deadline: string | null
  is_talent_program: boolean
  homepage_featured_image_url?: string | null
  homepage_featured_summary?: string | null
}

export interface Review {
  id: string
  listing: string
  rating: number
  comment: string
  internship_year: number
  is_anonymous: boolean
  created_at: string
}

export interface InternshipJournal {
  id: string
  title: string
  content: string
  internship_year: number
  is_anonymous: boolean
  likes_count: number
  created_at: string
  updated_at: string
  student_display_name: string
  listing_title: string | null
  listing_id: string | null
  comments_count: number
  comments: JournalComment[]
}

export interface JournalComment {
  id: string
  journal: string
  content: string
  is_anonymous: boolean
  created_at: string
  student_display_name: string
}

export interface NotificationPreferences {
  enabled: boolean
  sectors: EMFocusArea[]
  locations: string[]
}

export interface UserProfile {
  id: string
  full_name: string
  iuc_email: string
  student_no: string | null
  department_year: number | null
  linkedin_url: string | null
  cv_url: string | null
  avatar_url: string | null
  is_verified: boolean
  is_staff: boolean
  completion_percentage: number
  missing_fields: string[]
  notification_preferences: NotificationPreferences
}

export interface DashboardStats {
  total_active_listings: number
  bookmarks_count: number
  new_listings_today: number
  listings_expiring_soon: number
}

export type ApplicationStatus = 'basvurdum' | 'mulakat' | 'kabul' | 'ret'

export interface Application {
  id: string
  listing: Listing
  status: ApplicationStatus
  applied_at: string
  notes: string
}

export interface BookmarkedListing extends Listing {
  bookmarked_at: string
}

export interface FilterState {
  em_focus_area: EMFocusArea[]
  internship_type: InternshipType[]
  company_origin: CompanyOrigin[]
  source_platform: SourcePlatform[]
  duration_bucket: DurationBucket[]
  is_talent_program?: boolean
  search: string
  ordering: string
  page: number
}

export interface PaginatedResponse<T> {
  results: T[]
  count: number
  next: string | null
  previous: string | null
}
