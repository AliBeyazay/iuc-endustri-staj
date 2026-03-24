import { NextRequest, NextResponse } from 'next/server'
import { getBackendApiBaseUrl } from '@/lib/backend-url'

export const runtime = 'nodejs'

const backendApiBaseUrl = getBackendApiBaseUrl()

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: Params) {
  const { id } = await context.params
  const targetUrl = new URL(`${backendApiBaseUrl}/listings/${id}/`)
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
    },
  })
}
