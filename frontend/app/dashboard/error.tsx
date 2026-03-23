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
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 text-sm mb-4">Dashboard gecici olarak yenileniyor</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="text-xs px-4 py-2 bg-[#1E3A5F] text-white rounded-lg"
          >
            Tekrar Dene
          </button>
          <button
            onClick={() => router.push('/listings')}
            className="text-xs px-4 py-2 border border-gray-200 rounded-lg text-gray-500"
          >
            İlanlara Dön
          </button>
        </div>
      </div>
    </div>
  )
}
