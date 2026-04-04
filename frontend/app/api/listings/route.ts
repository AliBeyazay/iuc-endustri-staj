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
      'ngrok-skip-browser-warning': 'true',
    },
    cache: 'no-store',
  })

  const body = await response.text()

  return new NextResponse(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  })
}
