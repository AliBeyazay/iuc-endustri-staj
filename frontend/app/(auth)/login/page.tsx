'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSession, signIn } from 'next-auth/react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  email: z.string().email('Gecerli bir e-posta girin.'),
  password: z.string().min(6, 'Sifre en az 6 karakter olmali.'),
})

type Form = z.infer<typeof schema>

const ERROR_MAP: Record<string, string> = {
  CredentialsSignin: 'E-posta veya sifre hatali',
  NotIUCEmail: 'Sadece @ogr.iuc.edu.tr veya @iuc.edu.tr adresleri kabul edilir',
  OAuthAccountNotLinked: 'Bu e-posta baska bir yontemle kayitli',
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const registered = searchParams.get('registered') === '1'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: Form) {
    setServerError('')

    const response = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (response?.error) {
      setServerError(ERROR_MAP[response.error] ?? 'Bir hata olustu, tekrar deneyin')
      return
    }

    const session = await getSession()
    if (session?.access_token) {
      document.cookie = `access_token=${encodeURIComponent(session.access_token)}; Path=/; SameSite=Lax`
    }

    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-1 text-xl font-medium text-gray-900">Giris Yap</h1>
      <p className="mb-5 text-sm text-gray-500">IUC ogrenci hesabinla devam et</p>

      {registered ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          Kaydiniz basariyla olusturuldu.
        </div>
      ) : null}

      {serverError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          {serverError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">E-posta</label>
          <input
            {...register('email')}
            type="email"
            placeholder="ornek@ogr.iuc.edu.tr"
            className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-[#1E3A5F] focus:outline-none"
          />
          {errors.email ? <p className="mt-1 text-[10px] text-red-500">{errors.email.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Sifre</label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              className="h-9 w-full rounded-lg border border-gray-200 px-3 pr-8 text-sm focus:border-[#1E3A5F] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400"
            >
              {showPassword ? 'Gizle' : 'Goster'}
            </button>
          </div>
          {errors.password ? (
            <p className="mt-1 text-[10px] text-red-500">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="text-right">
          <button
            type="button"
            onClick={() => router.push('/forgot-password')}
            className="text-[10px] text-[#1E3A5F] hover:underline"
          >
            Sifremi unuttum
          </button>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-10 w-full rounded-lg bg-[#1E3A5F] text-sm font-medium text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Giris yapiliyor...' : 'Giris Yap'}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-gray-400">
        Hesabin yok mu?{' '}
        <button
          onClick={() => router.push('/register')}
          className="font-medium text-[#1E3A5F] hover:underline"
        >
          Kayit Ol
        </button>
      </p>
    </div>
  )
}
