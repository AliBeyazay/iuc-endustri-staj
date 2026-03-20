import { NextRequest, NextResponse } from 'next/server'
import { getBackendApiBaseUrl } from '@/lib/backend-url'

export const runtime = 'nodejs'

const backendApiBaseUrl = getBackendApiBaseUrl()

export async function GET(request: NextRequest) {
  const targetUrl = new URL(`${backendApiBaseUrl}/listings/`)
  targetUrl.search = request.nextUrl.search

  const response = await fetch(targetUrl.toString(), {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  const body = await response.text()

  return new NextResponse(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
    },
  })
}
