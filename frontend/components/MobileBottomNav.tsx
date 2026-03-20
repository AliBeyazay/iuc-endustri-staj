'use client'
import Link from 'next/link'

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
    'flex min-w-0 flex-1 items-center justify-center rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors',
    active ? 'bg-[#f1d27e] text-[#10223b]' : 'text-[#f7ecd0]/82 hover:bg-white/8 hover:text-white',
  ].join(' ')

  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={className}>
      {label}
    </button>
  )
}

export default function MobileBottomNav({ current, onFilterToggle, filterActive = false }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#d8ad43]/20 bg-[#10223b]/96 px-3 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-5xl items-center gap-2">
        <Item label="İlanlar" href="/listings" active={current === 'listings'} />
        <Item
          label="Filtre"
          active={filterActive}
          onClick={onFilterToggle ?? (() => undefined)}
        />
        <Item label="Kaydedilenler" href="/dashboard#saved" active={current === 'saved'} />
        <Item label="Profil" href="/dashboard#profile" active={current === 'profile'} />
      </div>
    </div>
  )
}
