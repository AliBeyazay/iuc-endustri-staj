import { NextResponse } from 'next/server'
import { getBackendApiBaseUrl } from '@/lib/backend-url'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const backendApiBaseUrl = getBackendApiBaseUrl()
    const response = await fetch(`${backendApiBaseUrl}/listings/facets/`, {
      headers: { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('backend error')
    return NextResponse.json(await response.json())
  } catch {
    return NextResponse.json({ em_focus_area: {}, source_platform: {} })
  }
}
