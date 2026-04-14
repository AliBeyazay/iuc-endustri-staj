import { NextRequest, NextResponse } from 'next/server'
import {
  buildPublicListingsCacheHeaders,
} from '@/lib/public-listings-cache'
import { loadListingById } from '@/lib/public-listings-source'
import { getPublicListingsSnapshotMetadata } from '@/lib/public-listings-snapshot'

export const runtime = 'nodejs'

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: Params) {
  const { id } = await context.params
  const { data, source, status } = await loadListingById(id)
  const snapshotMetadata = await getPublicListingsSnapshotMetadata()
  const snapshotHeaders = snapshotMetadata.generatedAt
    ? {
        'X-IUC-Public-Snapshot-Generated-At': snapshotMetadata.generatedAt,
        'X-IUC-Public-Snapshot-Fresh': String(snapshotMetadata.isFresh),
      }
    : {}

  if (!data) {
    return NextResponse.json(
      { error: status === 404 ? 'Ilan bulunamadi.' : 'Ilan detayi zamaninda alinamadi.' },
      {
        status: status === 404 ? 404 : 504,
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
