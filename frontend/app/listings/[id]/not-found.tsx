import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f9f9ff] flex items-center justify-center dark:bg-[#0e1e33]">
      <div className="text-center">
        <p className="text-4xl font-medium text-gray-200 mb-3 dark:text-white/15">404</p>
        <p className="text-gray-500 text-sm mb-5 dark:text-[#e7edf4]/50">İlan bulunamadı veya kaldırılmış olabilir.</p>
        <Link
          href="/listings"
          className="text-sm text-[#1E3A5F] border border-[#1E3A5F] px-4 py-2 rounded-lg hover:bg-blue-50 dark:text-[#d8ad43] dark:border-[#d8ad43]/30 dark:hover:bg-[#d8ad43]/10"
        >
          ← Tüm İlanlara Dön
        </Link>
      </div>
    </div>
  )
}
