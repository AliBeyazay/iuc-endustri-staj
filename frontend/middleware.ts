import { auth } from '@/auth'
import { NextResponse } from 'next/server'

const PROTECTED = ['/dashboard', '/profile', '/bookmarks']
const AUTH_ONLY  = ['/login', '/register', '/forgot-password', '/reset-password']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session      = req.auth

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p))
  const isAuthOnly  = AUTH_ONLY.some((p) => pathname.startsWith(p))

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
  matcher: ['/dashboard/:path*', '/profile/:path*', '/bookmarks/:path*'],
}
