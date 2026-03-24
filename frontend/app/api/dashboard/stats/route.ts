import { NextRequest, NextResponse } from 'next/server'
import { getBackendApiBaseUrl } from '@/lib/backend-url'

export const runtime = 'nodejs'

const backendApiBaseUrl = getBackendApiBaseUrl()

export async function GET(request: NextRequest) {
  const targetUrl = `${backendApiBaseUrl}/dashboard/stats/`

  const authorization = request.headers.get('authorization')
  const cookie = request.headers.get('cookie')

  const headers = new Headers({ Accept: 'application/json' })
  headers.set('ngrok-skip-browser-warning', 'true')
  if (authorization) headers.set('Authorization', authorization)
  if (cookie) headers.set('Cookie', cookie)

  const response = await fetch(targetUrl, {
    headers,
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
