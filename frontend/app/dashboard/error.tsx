'use client'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center p-8 text-center bg-[#f9f9ff] dark:bg-[#0e1e33] rounded-xl border border-gray-100 dark:border-white/5 shadow-sm m-4">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30">
        <AlertCircle className="h-8 w-8 text-rose-600 dark:text-rose-500" />
      </div>
      
      <h2 className="mb-2 text-xl font-bold text-[#132843] dark:text-[#e7edf4]">
        Dashboard Yüklenirken Bir Hata Oluştu
      </h2>
      
      <p className="mb-6 max-w-md text-sm text-gray-600 dark:text-[#e7edf4]/70">
        <span className="font-semibold text-rose-600 dark:text-rose-400 block mb-2">{error.message || 'Beklenmeyen bir hata meydana geldi.'}</span>
        Lütfen bağlantınızı kontrol edip tekrar deneyin veya sistem yöneticisiyle iletişime geçin.
      </p>
      
      <div className="flex gap-3 justify-center">
        <button
          onClick={reset}
          className="rounded-lg bg-[#132843] px-6 py-2.5 text-sm font-bold tracking-wide text-white transition-all hover:bg-[#1e3a5f] dark:bg-[#d8ad43] dark:text-[#132843] dark:hover:bg-[#c79828]"
        >
          Tekrar Dene
        </button>
        <button
          onClick={() => router.push('/')}
          className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-bold tracking-wide text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/20 dark:bg-white/5 dark:text-[#e7edf4] dark:hover:bg-white/10"
        >
          Ana Sayfaya Dön
        </button>
      </div>
    </div>
  )
}
