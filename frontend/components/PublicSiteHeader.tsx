'use client'

import Link from 'next/link'
import ProfileDropdown from '@/components/ProfileDropdown'
import UniversityLogo from '@/components/UniversityLogo'

type PublicSiteHeaderProps = {
  activePath?: '/' | '/listings' | '/dashboard' | '/profile'
}

const NAV_ITEMS = [
  { label: 'Anasayfa', href: '/' as const },
  { label: 'İlanlar', href: '/listings' as const },
  { label: 'Başvurular', href: '/dashboard' as const },
  { label: 'Profil', href: '/profile' as const },
]

export default function PublicSiteHeader({ activePath = '/listings' }: PublicSiteHeaderProps) {
  return (
    <nav className="campus-nav sticky top-0 z-50">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-4">
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
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === activePath
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-b-2 border-[#D4AF37] pb-1 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
          <ProfileDropdown />
        </div>
      </div>
    </nav>
  )
}
