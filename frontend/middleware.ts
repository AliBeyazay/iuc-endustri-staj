import { auth } from '@/auth'
import { NextResponse } from 'next/server'

const PROTECTED = ['/dashboard', '/profile', '/bookmarks']
const AUTH_ONLY  = ['/login', '/register', '/forgot-password', '/reset-password']

function isMobilePhoneUserAgent(userAgent: string) {
  if (!userAgent) return false

  return /(iphone|ipod|android.*mobile|windows phone|opera mini|mobile safari)/i.test(userAgent)
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session      = req.auth
  const userAgent = req.headers.get('user-agent') ?? ''

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p))
  const isAuthOnly  = AUTH_ONLY.some((p) => pathname.startsWith(p))

  if (pathname === '/' && isMobilePhoneUserAgent(userAgent)) {
    const url = req.nextUrl.clone()
    url.pathname = '/listings'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Not logged in → redirect to login
  if (isProtected && !session) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  // Already logged in → redirect to dashboard
  if (isAuthOnly && session) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/', '/dashboard/:path*', '/profile/:path*', '/bookmarks/:path*'],
}
