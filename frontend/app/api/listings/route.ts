import { NextRequest, NextResponse } from 'next/server'

const backendApiBaseUrl =
  process.env.API_INTERNAL_URL ?? 'http://backend:8000/api'

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
