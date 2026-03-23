'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Menu, SlidersHorizontal, X } from 'lucide-react'

interface Props {
  current: 'listings' | 'saved' | 'profile' | 'detail'
  onFilterToggle?: () => void
  filterActive?: boolean
}

function Item({
  label,
  href,
  active,
  onClick,
}: {
  label: string
  href?: string
  active?: boolean
  onClick?: () => void
}) {
  const className = [
    'flex min-w-0 w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition-colors',
    active
      ? 'bg-[#f1d27e] text-[#10223b]'
      : 'border border-white/10 bg-white/[0.04] text-[#f7ecd0]/86 hover:bg-white/[0.08] hover:text-white',
  ].join(' ')

  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  )
}

export default function MobileBottomNav({ current, onFilterToggle, filterActive = false }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  const currentLabel = useMemo(() => {
    switch (current) {
      case 'saved':
        return 'Kaydedilenler'
      case 'profile':
        return 'Profil'
      case 'detail':
        return 'İlan Detayı'
      case 'listings':
      default:
        return 'İlanlar'
    }
  }, [current])

  function closeMenu() {
    setMenuOpen(false)
  }

  function handleFilterClick() {
    onFilterToggle?.()
    setMenuOpen(false)
  }

  return (
    <>
      {menuOpen ? (
        <button
          type="button"
          aria-label="Menuyu kapat"
          onClick={closeMenu}
          className="fixed inset-0 z-30 bg-[#10223b]/30 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 py-3 lg:hidden">
        <div className="mx-auto max-w-5xl rounded-[26px] border border-[#d8ad43]/18 bg-[#10223b]/96 px-4 py-3 shadow-[0_18px_50px_rgba(7,16,28,0.30)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#f7ecd0]/40">Menu</p>
              <p className="mt-1 truncate text-sm font-semibold text-[#f7ecd0]">{currentLabel}</p>
            </div>

            <div className="flex items-center gap-2">
              {onFilterToggle ? (
                <button
                  type="button"
                  onClick={handleFilterClick}
                  aria-label="Filtreleri ac"
                  className={[
                    'inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors',
                    filterActive
                      ? 'border-[#f1d27e]/50 bg-[#f1d27e] text-[#10223b]'
                      : 'border-white/10 bg-white/[0.04] text-[#f7ecd0]',
                  ].join(' ')}
                >
                  <SlidersHorizontal size={18} strokeWidth={2.2} />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                aria-expanded={menuOpen}
                aria-label={menuOpen ? 'Menuyu kapat' : 'Menuyu ac'}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#f7ecd0] transition-colors hover:bg-white/[0.08]"
              >
                {menuOpen ? <X size={20} strokeWidth={2.2} /> : <Menu size={20} strokeWidth={2.2} />}
              </button>
            </div>
          </div>
        </div>

        {menuOpen ? (
          <div className="mx-auto mt-3 max-w-5xl rounded-[28px] border border-[#d8ad43]/18 bg-[#10223b]/98 p-3 shadow-[0_24px_60px_rgba(7,16,28,0.34)] backdrop-blur">
            <div className="grid gap-2">
              <Item label="İlanlar" href="/listings" active={current === 'listings'} />
              {onFilterToggle ? (
                <Item label="Filtre" active={filterActive} onClick={handleFilterClick} />
              ) : null}
              <Item label="Kaydedilenler" href="/dashboard#saved" active={current === 'saved'} />
              <Item label="Profil" href="/dashboard#profile" active={current === 'profile'} />
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
