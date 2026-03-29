'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { forgotPassword } from '@/lib/api'

// ── Forgot Password ──────────────────────────────────────────────────────────
export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await forgotPassword(email)
    } finally {
      setLoading(false)
      setSent(true) // always show sent state (security)
    }
  }

  return (
    <div className="w-full max-w-sm">
      {!sent ? (
        <>
          <h1 className="text-xl font-medium text-gray-900 mb-1 dark:text-[#e7edf4]">Şifre Sıfırla</h1>
          <p className="text-sm text-gray-500 mb-5 dark:text-[#e7edf4]/50">E-posta adresine sıfırlama linki gönderilecek</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-[#e7edf4]/60">E-posta</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@ogr.iuc.edu.tr" required
                className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F] dark:border-[#d8ad43]/18 dark:bg-[#0e1e33] dark:text-[#e7edf4] dark:focus:border-[#d8ad43]/40" />
            </div>
            <button type="submit" disabled={loading || !email}
              className="w-full h-10 bg-[#1E3A5F] text-white rounded-lg text-sm font-medium disabled:opacity-50 dark:bg-[#d8ad43] dark:text-[#10223b]">
              {loading ? 'Gönderiliyor...' : 'Sıfırlama Linki Gönder'}
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-4 dark:text-[#e7edf4]/40">
            <button onClick={() => router.push('/login')} className="text-[#1E3A5F] hover:underline">← Giriş sayfasına dön</button>
          </p>
        </>
      ) : (
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-xl mx-auto mb-4">✓</div>
          <h1 className="text-xl font-medium text-gray-900 mb-2 dark:text-[#e7edf4]">E-posta Gönderildi</h1>
          <p className="text-sm text-gray-500 mb-5 leading-relaxed dark:text-[#e7edf4]/50">
            E-posta kutunu kontrol et. Link 15 dakika geçerlidir.
          </p>
          <button onClick={() => setSent(false)} className="text-xs text-[#1E3A5F] hover:underline">
            Farklı bir adres dene
          </button>
        </div>
      )}
    </div>
  )
}
