import { NextRequest, NextResponse } from 'next/server'

const backendApiBaseUrl =
  process.env.API_INTERNAL_URL ?? 'http://backend:8000/api'

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const pathname = path.length ? `${path.join('/')}/` : ''
  const targetUrl = new URL(`${backendApiBaseUrl}/${pathname}`)
  targetUrl.search = request.nextUrl.search

  const contentType = request.headers.get('content-type')
  const accept = request.headers.get('accept') ?? 'application/json'
  const authorization = request.headers.get('authorization')
  const cookie = request.headers.get('cookie')

  const headers = new Headers({ Accept: accept })
  if (contentType) headers.set('Content-Type', contentType)
  if (authorization) headers.set('Authorization', authorization)
  if (cookie) headers.set('Cookie', cookie)

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
    redirect: 'manual',
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

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context)
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context)
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context)
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context)
}
