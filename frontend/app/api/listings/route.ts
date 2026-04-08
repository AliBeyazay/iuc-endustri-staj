import { NextRequest, NextResponse } from 'next/server'
import {
  buildPublicListingsCacheHeaders,
} from '@/lib/public-listings-cache'
import { loadListingsResponse } from '@/lib/public-listings-source'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { data, source } = await loadListingsResponse(request.nextUrl)

  if (!data) {
    return NextResponse.json(
      { error: 'Ilanlar zamaninda alinamadi.' },
      {
        status: 504,
        headers: buildPublicListingsCacheHeaders(),
      },
    )
  }

  return NextResponse.json(data, {
    headers: {
      ...buildPublicListingsCacheHeaders(),
      'X-IUC-Public-Data-Source': source ?? 'unknown',
    },
  })
}
