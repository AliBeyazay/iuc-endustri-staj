'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { fetchEncodingQualityReport } from '@/lib/api'
import { EncodingQualityReport } from '@/types'
import ThemeToggle from '@/components/ThemeToggle'

function formatFieldLabel(field: string): string {
  const map: Record<string, string> = {
    title: 'Başlık',
    company_name: 'Şirket',
    location: 'Konum',
    description: 'Açıklama',
    requirements: 'Gereksinimler',
  }
  return map[field] ?? field
}

export default function EncodingQualityPage() {
  const router = useRouter()
  const { status } = useSession()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [router, status])

  const { data, error, isLoading, mutate } = useSWR<EncodingQualityReport>(
    status === 'authenticated' ? 'encoding-quality-report' : null,
    fetchEncodingQualityReport,
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
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Encoding Kalitesi Monitoring</h1>
            <p className="text-sm text-[#173156]/70 dark:text-[#e7edf4]/65">
              Mojibake ve karakter bozukluğu tespiti
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
            Rapor alınamadı. Lütfen tekrar dene.
          </div>
        ) : null}

        {data ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
                <p className="text-xs text-[#173156]/65 dark:text-[#e7edf4]/60">Taranan İlan</p>
                <p className="mt-1 text-2xl font-semibold">{data.totals.total_listings_scanned}</p>
              </div>
              <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
                <p className="text-xs text-[#173156]/65 dark:text-[#e7edf4]/60">Bozuk İlan</p>
                <p className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">{data.totals.corrupted_listings}</p>
              </div>
              <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
                <p className="text-xs text-[#173156]/65 dark:text-[#e7edf4]/60">Temiz İlan</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{data.totals.clean_listings}</p>
              </div>
              <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
                <p className="text-xs text-[#173156]/65 dark:text-[#e7edf4]/60">Bozulma Oranı</p>
                <p className="mt-1 text-2xl font-semibold">{data.totals.corruption_rate_percent}%</p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
                <h2 className="text-sm font-semibold">Alan Bazlı Hata</h2>
                <div className="mt-3 space-y-2">
                  {Object.entries(data.field_issue_counts).length === 0 ? (
                    <p className="text-sm text-[#173156]/65 dark:text-[#e7edf4]/60">Hata bulunmadı.</p>
                  ) : (
                    Object.entries(data.field_issue_counts).map(([field, count]) => (
                      <div key={field} className="flex items-center justify-between rounded-lg bg-[#f5f7fb] px-3 py-2 text-sm dark:bg-white/5">
                        <span>{formatFieldLabel(field)}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
                <h2 className="text-sm font-semibold">Platform Bazlı Hata</h2>
                <div className="mt-3 space-y-2">
                  {data.top_problem_platforms.length === 0 ? (
                    <p className="text-sm text-[#173156]/65 dark:text-[#e7edf4]/60">Hata bulunmadı.</p>
                  ) : (
                    data.top_problem_platforms.map((item) => (
                      <div key={item.source_platform} className="flex items-center justify-between rounded-lg bg-[#f5f7fb] px-3 py-2 text-sm dark:bg-white/5">
                        <span>{item.source_platform}</span>
                        <span className="font-semibold">{item.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
              <h2 className="text-sm font-semibold">Örnek Sorunlu Kayıtlar</h2>
              <p className="mt-1 text-xs text-[#173156]/65 dark:text-[#e7edf4]/60">
                Son rapor zamanı: {new Date(data.generated_at).toLocaleString('tr-TR')}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#d8ad43]/20 text-xs uppercase tracking-wide text-[#173156]/65 dark:text-[#e7edf4]/60">
                      <th className="px-2 py-2">Platform</th>
                      <th className="px-2 py-2">Başlık</th>
                      <th className="px-2 py-2">Şirket</th>
                      <th className="px-2 py-2">Sorunlu Alanlar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.samples.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-2 py-4 text-sm text-emerald-700 dark:text-emerald-400">
                          Tebrikler, örneklenmiş bozuk kayıt yok.
                        </td>
                      </tr>
                    ) : (
                      data.samples.map((sample) => (
                        <tr key={sample.id} className="border-b border-[#d8ad43]/10 align-top">
                          <td className="px-2 py-3">{sample.source_platform}</td>
                          <td className="px-2 py-3">{sample.title}</td>
                          <td className="px-2 py-3">{sample.company_name}</td>
                          <td className="px-2 py-3">{sample.problem_fields.map(formatFieldLabel).join(', ')}</td>
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
