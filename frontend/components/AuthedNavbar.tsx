'use client'

import Link from 'next/link'
import UniversityLogo from '@/components/UniversityLogo'
import ProfileDropdown from '@/components/ProfileDropdown'

type NavPath = '/listings' | '/dashboard' | '/profile'

const NAV_LINKS: Array<{ label: string; href: NavPath }> = [
  { label: 'İlanlar', href: '/listings' },
  { label: 'Başvurular', href: '/dashboard' },
  { label: 'Profil', href: '/profile' },
]

interface AuthedNavbarProps {
  activePath: NavPath
}

export default function AuthedNavbar({ activePath }: AuthedNavbarProps) {
  return (
    <nav
      className="sticky top-0 z-30 bg-[#1A233A] shadow-md"
      style={{
        borderBottom: '2px solid transparent',
        borderImage: 'linear-gradient(to right, #B8860B, #F3E5AB, #B8860B) 1',
      }}
    >
      <div
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-0 sm:px-6"
        style={{ height: '64px' }}
      >
        <Link href="/listings" className="flex items-center gap-4">
          <UniversityLogo className="h-10 w-10 shrink-0 rounded border border-[#D4AF37] p-0.5" />
          <div className="min-w-0">
            <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37] sm:text-sm">
              İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA
            </span>
            <p className="truncate text-[9px] tracking-wider text-gray-300 sm:text-xs">
              ENDÜSTRİ MÜHENDİSLİĞİ STAJ PLATFORMU
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-8">
          <div className="hidden items-center gap-8 sm:flex">
            {NAV_LINKS.map((nav) => (
              <Link
                key={nav.href}
                href={nav.href}
                className={`text-sm font-medium transition-colors ${
                  activePath === nav.href
                    ? 'border-b-2 border-[#D4AF37] pb-1 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {nav.label}
              </Link>
            ))}
          </div>
          <ProfileDropdown />
        </div>
      </div>
    </nav>
  )
}
