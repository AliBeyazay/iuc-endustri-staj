import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl font-medium text-gray-200 mb-3">404</p>
        <p className="text-gray-500 text-sm mb-5">İlan bulunamadı veya kaldırılmış olabilir.</p>
        <Link
          href="/listings"
          className="text-sm text-[#1E3A5F] border border-[#1E3A5F] px-4 py-2 rounded-lg hover:bg-blue-50"
        >
          ← Tüm İlanlara Dön
        </Link>
      </div>
    </div>
  )
}
