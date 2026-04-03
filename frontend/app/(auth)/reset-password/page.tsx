'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resetPassword } from '@/lib/api'

const schema = z.object({
  password:         z.string().min(8, 'En az 8 karakter'),
  password_confirm: z.string(),
}).refine((d) => d.password === d.password_confirm, {
  message: 'Şifreler eşleşmiyor',
  path: ['password_confirm'],
})
type Form = z.infer<typeof schema>

function StrengthBar({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  const colors = ['bg-gray-200', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500']
  const labels = ['', 'Zayıf', 'Orta', 'İyi', 'Güçlü']

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= score ? colors[score] : 'bg-gray-200'}`} />
        ))}
      </div>
      {password && <p className="text-[10px] text-gray-400">{labels[score]}</p>}
    </div>
  )
}

const browserApiBaseUrl = '/backend-api'

function ResetPasswordPageContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const token        = searchParams.get('token')

  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [success, setSuccess]       = useState(false)
  const [showPw, setShowPw]         = useState(false)
  const pw = ''

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) })

  const watchedPw = watch('password', '')

  useEffect(() => {
    if (!token) { setTokenValid(false); return }
    fetch(`${browserApiBaseUrl}/auth/validate-reset-token/?token=${token}`)
      .then((r) => setTokenValid(r.ok))
      .catch(() => setTokenValid(false))
  }, [token])

  async function onSubmit(data: Form) {
    try {
      await resetPassword(token!, data.password)
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      // handled by api interceptor
    }
  }

  if (tokenValid === null) {
    return (
      <div className="w-full text-center py-10">
        <p className="text-sm text-[#44474d] dark:text-white/50">Doğrulanıyor...</p>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className="w-full">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <p className="text-sm font-medium text-red-700 mb-1">Geçersiz veya süresi dolmuş link</p>
          <p className="text-xs text-red-500 mb-4">Bu şifre sıfırlama linki artık geçerli değil.</p>
          <button onClick={() => router.push('/forgot-password')}
            className="text-sm font-bold text-[#d8ad43] hover:text-[#c79828] transition-colors">
            Yeni link iste →
          </button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="w-full text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-2xl mx-auto mb-4">✓</div>
        <h1 className="text-2xl font-bold text-[#051c38] dark:text-white mb-2 campus-heading">Şifren Güncellendi</h1>
        <p className="text-sm text-[#44474d] dark:text-white/50">Giriş sayfasına yönlendiriliyorsun...</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold text-[#051c38] dark:text-white mb-1 campus-heading">Yeni Şifre Belirle</h1>
      <p className="text-sm text-[#44474d] dark:text-white/50 mb-6">En az 8 karakter, büyük harf ve rakam içermeli</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#051c38] dark:text-white">Yeni Şifre</label>
          <div className="relative">
            <input {...register('password')} type={showPw ? 'text' : 'password'}
              className="w-full py-4 px-4 pr-12 bg-[#e7eeff] dark:bg-[#1d314e] border-none rounded-xl text-sm text-[#051c38] dark:text-white placeholder:text-[#051c38]/30 dark:placeholder:text-white/25 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#d8ad43] transition-all" />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#051c38]/40 dark:text-white/30 hover:text-[#051c38] dark:hover:text-white transition-colors text-xs">
              {showPw ? 'Gizle' : 'Göster'}
            </button>
          </div>
          {errors.password && <p className="text-[10px] text-red-500 mt-1">{errors.password.message}</p>}
          <StrengthBar password={watchedPw} />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#051c38] dark:text-white">Şifre Tekrar</label>
          <input {...register('password_confirm')} type="password"
            className="w-full py-4 px-4 bg-[#e7eeff] dark:bg-[#1d314e] border-none rounded-xl text-sm text-[#051c38] dark:text-white placeholder:text-[#051c38]/30 dark:placeholder:text-white/25 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#d8ad43] transition-all" />
          {errors.password_confirm && (
            <p className="text-[10px] text-red-500 mt-1">{errors.password_confirm.message}</p>
          )}
        </div>

        <button type="submit" disabled={isSubmitting}
          className="w-full py-4 bg-[#051c38] dark:bg-[#d8ad43] text-white dark:text-[#10223b] rounded-xl font-bold shadow-lg shadow-[#051c38]/10 active:scale-[0.98] transition-all disabled:opacity-50">
          {isSubmitting ? 'Kaydediliyor...' : 'Şifremi Güncelle'}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-sm" />}>
      <ResetPasswordPageContent />
    </Suspense>
  )
}
