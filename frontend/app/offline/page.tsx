'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type RecentItem = {
  id: string
  title: string
  company_name: string
  viewedAt: number
}

const RECENT_KEY = 'iuc_recently_viewed'

export default function OfflinePage() {
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      const parsed = raw ? (JSON.parse(raw) as RecentItem[]) : []
      setRecentItems(Array.isArray(parsed) ? parsed : [])
    } catch {
      setRecentItems([])
    }
  }, [])

  const hasRecent = useMemo(() => recentItems.length > 0, [recentItems.length])

  return (
    <div className="campus-shell min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="campus-card rounded-[28px] p-6">
          <h1 className="text-xl font-semibold text-[#132843] dark:text-[#e7edf4]">Cevrimdisisin</h1>
          <p className="mt-2 text-sm text-[#173156]/70 dark:text-[#e7edf4]/60">
            Internet baglantisi su anda yok. Son goruntulenen ilanlarini asagida gorebilirsin.
          </p>
          <Link
            href="/listings"
            className="mt-4 inline-block rounded-xl border border-[#d8ad43]/30 bg-[#fff8e8] px-4 py-2 text-sm font-medium text-[#8f670b] dark:bg-[#d8ad43]/10 dark:text-[#f0cf7a]"
          >
            Baglanti gelince ilanlara don
          </Link>
        </div>

        <div className="campus-card rounded-[28px] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8f670b] dark:text-[#f0cf7a]">
            Son Goruntulenen Ilanlar
          </h2>
          {!hasRecent ? (
            <p className="mt-3 text-sm text-[#173156]/70 dark:text-[#e7edf4]/60">
              Cevrimdisi goruntulemek icin once birkac ilan detayini acmis olman gerekir.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {recentItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/listings/${item.id}`}
                  className="block rounded-xl border border-[#d8ad43]/16 bg-white/65 px-4 py-3 transition-colors hover:border-[#d8ad43]/30 hover:bg-white/80 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <p className="text-sm font-semibold text-[#132843] dark:text-[#e7edf4]">{item.title}</p>
                  <p className="mt-1 text-xs text-[#173156]/65 dark:text-[#e7edf4]/55">{item.company_name}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
