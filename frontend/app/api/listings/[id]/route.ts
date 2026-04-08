import { NextRequest, NextResponse } from 'next/server'
import {
  buildPublicListingsCacheHeaders,
} from '@/lib/public-listings-cache'
import { loadListingById } from '@/lib/public-listings-source'

export const runtime = 'nodejs'

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: Params) {
  const { id } = await context.params
  const { data, source, status } = await loadListingById(id)

  if (!data) {
    return NextResponse.json(
      { error: status === 404 ? 'Ilan bulunamadi.' : 'Ilan detayi zamaninda alinamadi.' },
      {
        status: status === 404 ? 404 : 504,
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
