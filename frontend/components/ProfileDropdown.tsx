'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { getAvatarColor, getInitials } from '@/lib/helpers'
import { ChevronDown, X } from 'lucide-react'

export default function ProfileDropdown() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2">
        <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
      </div>
    )
  }

  if (status !== 'authenticated') {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="shrink-0 whitespace-nowrap rounded-full border border-[#d8ad43]/35 bg-[#f1d27e] px-3 py-2 text-xs font-bold text-[#10223b] shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-px sm:hidden"
        >
          Giriş
        </button>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="hidden rounded-full border border-white/18 bg-white/8 px-3 py-2 text-xs font-semibold text-[#f7ecd0] transition-colors hover:bg-white/14 sm:inline-flex"
        >
          Giriş Yap
        </button>
        <button
          type="button"
          onClick={() => router.push('/register')}
          className="hidden rounded-full border border-[#d8ad43]/40 bg-[#f1d27e] px-3 py-2 text-xs font-bold text-[#10223b] shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-px sm:inline-flex"
        >
          Kayıt Ol
        </button>
      </div>
    )
  }

  const name = session?.user?.name ?? ''
  const initials = getInitials(name || '??')
  const avatarColor = getAvatarColor(name)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-[#d8ad43]/35 bg-[#f1d27e] py-1 pl-1 pr-2.5 text-[10px] font-bold text-[#10223b] shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-px hover:ring-2 hover:ring-[#d8ad43]/30"
        aria-label="Profil menüsü"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10223b]/10 text-[10px] font-bold">
          {initials}
        </span>
        <ChevronDown size={14} strokeWidth={2.5} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* backdrop for mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] sm:hidden"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-[#d8ad43]/20 bg-[#10223b] shadow-[0_18px_50px_rgba(7,16,28,0.40)] animate-scale-in origin-top-right">
            {/* user info */}
            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${avatarColor}`}>
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#f7ecd0]">{name}</p>
                  <p className="truncate text-[10px] text-[#f7ecd0]/50">{session?.user?.iuc_email}</p>
                </div>
              </div>
            </div>

            {/* menu items */}
            <div className="p-2">
              <Link
                href="/listings"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-[#f7ecd0] transition-all duration-150 hover:bg-white/10 hover:pl-4"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#d8ad43]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                İlanlar
              </Link>

              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-[#f7ecd0] transition-all duration-150 hover:bg-white/10 hover:pl-4"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#d8ad43]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Başvurular
              </Link>

              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-[#f7ecd0] transition-all duration-150 hover:bg-white/10 hover:pl-4"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#d8ad43]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profil
              </Link>
            </div>

            {/* sign out */}
            <div className="border-t border-white/10 p-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  signOut({ callbackUrl: '/login' })
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition-all duration-150 hover:bg-red-500/10 hover:pl-4"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Çıkış Yap
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
