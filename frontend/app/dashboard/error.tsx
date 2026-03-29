'use client'
import { useRouter } from 'next/navigation'

export default function DashboardError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center dark:bg-[#0b1a2c]">
      <div className="text-center">
        <p className="text-gray-500 text-sm mb-4 dark:text-[#e7edf4]/50">Dashboard gecici olarak yenileniyor</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="text-xs px-4 py-2 bg-[#1E3A5F] text-white rounded-lg dark:bg-[#d8ad43] dark:text-[#10223b]"
          >
            Tekrar Dene
          </button>
          <button
            onClick={() => router.push('/listings')}
            className="text-xs px-4 py-2 border border-gray-200 rounded-lg text-gray-500 dark:border-[#d8ad43]/18 dark:text-[#e7edf4]/50"
          >
            İlanlara Dön
          </button>
        </div>
      </div>
    </div>
  )
}
