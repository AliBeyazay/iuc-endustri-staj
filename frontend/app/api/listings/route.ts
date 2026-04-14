import { NextRequest, NextResponse } from 'next/server'
import {
  buildPublicListingsCacheHeaders,
} from '@/lib/public-listings-cache'
import { loadListingsResponse } from '@/lib/public-listings-source'
import { getPublicListingsSnapshotMetadata } from '@/lib/public-listings-snapshot'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { data, source } = await loadListingsResponse(request.nextUrl)
  const snapshotMetadata = await getPublicListingsSnapshotMetadata()
  const snapshotHeaders = snapshotMetadata.generatedAt
    ? {
        'X-IUC-Public-Snapshot-Generated-At': snapshotMetadata.generatedAt,
        'X-IUC-Public-Snapshot-Fresh': String(snapshotMetadata.isFresh),
      }
    : {}

  if (!data) {
    return NextResponse.json(
      { error: 'Ilanlar zamaninda alinamadi.' },
      {
        status: 504,
        headers: {
          ...buildPublicListingsCacheHeaders(),
          ...snapshotHeaders,
        },
      },
    )
  }

  return NextResponse.json(data, {
    headers: {
      ...buildPublicListingsCacheHeaders(),
      'X-IUC-Public-Data-Source': source ?? 'unknown',
      ...snapshotHeaders,
    },
  })
}
