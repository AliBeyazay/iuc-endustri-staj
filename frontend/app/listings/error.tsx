'use client'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

export default function ListingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center bg-[#f9f9ff] dark:bg-[#0e1e33] rounded-xl border border-gray-100 dark:border-white/5 shadow-sm m-4 mt-8 md:m-8">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30">
        <AlertCircle className="h-8 w-8 text-rose-600 dark:text-rose-500" />
      </div>
      
      <h2 className="mb-2 text-xl md:text-2xl font-bold text-[#132843] dark:text-[#e7edf4]">
        İlanlar Yüklenirken Bir Hata Oluştu
      </h2>
      
      <p className="mb-8 max-w-lg text-sm md:text-base text-gray-600 dark:text-[#e7edf4]/70">
        <span className="font-semibold text-rose-600 dark:text-rose-400 block mb-2">{error.message || 'Veri kaynağına (API) erişim sağlanamadı. Sunucu geçici bir kesinti yaşıyor olabilir.'}</span>
        Filtreleri veya arama kriterlerini değiştirmiş olabilirsiniz. İlanları tazelemeyi deneyin.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-3 justify-center w-full sm:w-auto">
        <button
          onClick={reset}
          className="rounded-lg bg-[#132843] px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-all hover:bg-[#1e3a5f] dark:bg-[#d8ad43] dark:text-[#132843] dark:hover:bg-[#c79828] whitespace-nowrap"
        >
          Tekrar Dene
        </button>
        <button
          onClick={() => {
            window.location.href = '/listings'
          }}
          className="rounded-lg border border-gray-300 bg-white px-8 py-3 text-sm font-bold uppercase tracking-wider text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/20 dark:bg-white/5 dark:text-[#e7edf4] dark:hover:bg-white/10 whitespace-nowrap"
        >
          Filtreleri Sıfırla
        </button>
        <button
          onClick={() => router.push('/')}
          className="rounded-lg bg-gray-100 px-8 py-3 text-sm font-bold uppercase tracking-wider text-gray-600 transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-[#e7edf4]/70 dark:hover:bg-white/20 dark:hover:text-[#e7edf4] whitespace-nowrap"
        >
          Kapat
        </button>
      </div>
    </div>
  )
}
