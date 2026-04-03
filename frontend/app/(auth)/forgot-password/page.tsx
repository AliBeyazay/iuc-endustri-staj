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
    <div className="w-full">
      {!sent ? (
        <>
          <h1 className="text-2xl font-bold text-[#051c38] dark:text-white mb-1 campus-heading">Şifre Sıfırla</h1>
          <p className="text-sm text-[#44474d] dark:text-white/50 mb-6">E-posta adresine sıfırlama linki gönderilecek</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#051c38] dark:text-white">E-posta</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@ogr.iuc.edu.tr" required
                className="w-full py-4 px-4 bg-[#e7eeff] dark:bg-[#1d314e] border-none rounded-xl text-sm text-[#051c38] dark:text-white placeholder:text-[#051c38]/30 dark:placeholder:text-white/25 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#d8ad43] transition-all" />
            </div>
            <button type="submit" disabled={loading || !email}
              className="w-full py-4 bg-[#051c38] dark:bg-[#d8ad43] text-white dark:text-[#10223b] rounded-xl font-bold shadow-lg shadow-[#051c38]/10 active:scale-[0.98] transition-all disabled:opacity-50">
              {loading ? 'Gönderiliyor...' : 'Sıfırlama Linki Gönder'}
            </button>
          </form>
          <p className="text-center text-sm text-[#44474d] dark:text-white/50 mt-6">
            <button onClick={() => router.push('/login')} className="font-bold text-[#d8ad43] hover:text-[#c79828] transition-colors">← Giriş sayfasına dön</button>
          </p>
        </>
      ) : (
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-2xl mx-auto mb-4">✓</div>
          <h1 className="text-2xl font-bold text-[#051c38] dark:text-white mb-2 campus-heading">E-posta Gönderildi</h1>
          <p className="text-sm text-[#44474d] dark:text-white/50 mb-6 leading-relaxed">
            E-posta kutunu kontrol et. Link 15 dakika geçerlidir.
          </p>
          <button onClick={() => setSent(false)} className="text-sm font-bold text-[#d8ad43] hover:text-[#c79828] transition-colors">
            Farklı bir adres dene
          </button>
        </div>
      )}
    </div>
  )
}
