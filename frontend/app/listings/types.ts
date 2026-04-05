import type { PaginatedResponse } from '@/types'

export type RawListing = {
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

export type ListingsResponse = PaginatedResponse<RawListing>
