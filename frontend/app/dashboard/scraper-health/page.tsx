'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { fetchScraperHealthReport } from '@/lib/api'
import { ScraperHealthReport } from '@/types'
import ThemeToggle from '@/components/ThemeToggle'

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('tr-TR')
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '-'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes} dk ${remaining}s`
}

export default function ScraperHealthPage() {
  const router = useRouter()
  const { status } = useSession()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [router, status])

  const { data, error, isLoading, mutate } = useSWR<ScraperHealthReport>(
    status === 'authenticated' ? 'scraper-health-report' : null,
    fetchScraperHealthReport,
    { revalidateOnFocus: false },
  )

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Oturum kontrol ediliyor...
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] px-4 py-6 text-[#132843] dark:bg-[#0f1f34] dark:text-[#e7edf4] sm:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Scraper Health Dashboard</h1>
            <p className="text-sm text-[#173156]/70 dark:text-[#e7edf4]/65">
              Spider çalışma durumu, eklenen ilanlar ve hata oranları
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => mutate()}
              className="rounded-lg border border-[#1E3A5F]/25 px-3 py-2 text-xs font-medium hover:bg-[#1E3A5F]/5"
            >
              Yenile
            </button>
            <Link
              href="/dashboard"
              className="rounded-lg border border-[#1E3A5F]/25 px-3 py-2 text-xs font-medium hover:bg-[#1E3A5F]/5"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 text-sm dark:bg-white/5">
            Rapor yükleniyor...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Scraper health raporu alınamadı.
          </div>
        ) : null}

        {data ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
                <p className="text-xs text-[#173156]/65 dark:text-[#e7edf4]/60">Spider</p>
                <p className="mt-1 text-2xl font-semibold">{data.totals.spider_count}</p>
              </div>
              <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
                <p className="text-xs text-[#173156]/65 dark:text-[#e7edf4]/60">Son 24s Çalışma</p>
                <p className="mt-1 text-2xl font-semibold">{data.totals.runs_in_window}</p>
              </div>
              <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
                <p className="text-xs text-[#173156]/65 dark:text-[#e7edf4]/60">Yeni + Güncel</p>
                <p className="mt-1 text-2xl font-semibold">
                  {data.totals.new_count + data.totals.updated_count}
                </p>
              </div>
              <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
                <p className="text-xs text-[#173156]/65 dark:text-[#e7edf4]/60">Hata Oranı</p>
                <p className="mt-1 text-2xl font-semibold">{data.totals.error_rate_percent}%</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
              <p className="text-xs text-[#173156]/65 dark:text-[#e7edf4]/60">
                Son rapor: {new Date(data.generated_at).toLocaleString('tr-TR')}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[1060px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#d8ad43]/20 text-xs uppercase tracking-wide text-[#173156]/65 dark:text-[#e7edf4]/60">
                      <th className="px-2 py-2">Spider</th>
                      <th className="px-2 py-2">Son Başlangıç</th>
                      <th className="px-2 py-2">Süre</th>
                      <th className="px-2 py-2">Son Çalışma (Y/G/S/H)</th>
                      <th className="px-2 py-2">24s Çalışma</th>
                      <th className="px-2 py-2">24s Toplam (Y/G/S/H)</th>
                      <th className="px-2 py-2">24s Hata %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.spiders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-4 text-sm text-[#173156]/65 dark:text-[#e7edf4]/60">
                          Henüz scraper log kaydı yok.
                        </td>
                      </tr>
                    ) : (
                      data.spiders.map((row) => (
                        <tr key={row.spider_name} className="border-b border-[#d8ad43]/10 align-top">
                          <td className="px-2 py-3 font-medium">{row.spider_name}</td>
                          <td className="px-2 py-3">{formatDate(row.last_started_at)}</td>
                          <td className="px-2 py-3">{formatDuration(row.last_duration_seconds)}</td>
                          <td className="px-2 py-3">
                            {row.last_run.new_count}/{row.last_run.updated_count}/{row.last_run.skipped_count}/{row.last_run.error_count}
                          </td>
                          <td className="px-2 py-3">{row.window.run_count}</td>
                          <td className="px-2 py-3">
                            {row.window.new_count}/{row.window.updated_count}/{row.window.skipped_count}/{row.window.error_count}
                          </td>
                          <td className="px-2 py-3">{row.window.error_rate_percent}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
