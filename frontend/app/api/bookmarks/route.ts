import { NextRequest, NextResponse } from 'next/server'
import { getBackendApiBaseUrl } from '@/lib/backend-url'

export const runtime = 'nodejs'

const backendApiBaseUrl = getBackendApiBaseUrl()

async function proxy(request: NextRequest) {
  const targetUrl = new URL(`${backendApiBaseUrl}/bookmarks/`)
  targetUrl.search = request.nextUrl.search

  // Tüm header'ları backend'e ilet
  const headers = new Headers(request.headers)
  headers.set('ngrok-skip-browser-warning', 'true')

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text()
  }

  const response = await fetch(targetUrl.toString(), init)
  const body = await response.text()

  return new NextResponse(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
    },
  })
}

export async function GET(request: NextRequest) {
  return proxy(request)
}

export async function POST(request: NextRequest) {
  return proxy(request)
}

export async function DELETE(request: NextRequest) {
  return proxy(request)
}
