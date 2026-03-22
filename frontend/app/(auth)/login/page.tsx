'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSession, signIn } from 'next-auth/react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { fetchAccountStatus, normalizeIucEmail, resendOTP, verifyOTP } from '@/lib/api'

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

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pendingVerification, setPendingVerification] = useState<{
    email: string
    password: string
  } | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')
  const [onscreenOtp, setOnscreenOtp] = useState('')
  const [isResendingCode, setIsResendingCode] = useState(false)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const registered = searchParams.get('registered') === '1'
  const prefilledEmail = searchParams.get('email') || ''

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: prefilledEmail,
      password: '',
    },
  })

  async function completeLogin(email: string, password: string) {
    const response = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl,
    })

    if (response?.error) {
      setServerError(ERROR_MAP[response.error] ?? 'Bir hata olustu, tekrar deneyin')
      return false
    }

    const session = await getSession()
    if (session?.access_token) {
      document.cookie = `access_token=${encodeURIComponent(session.access_token)}; Path=/; SameSite=Lax`
    }

    router.replace(response?.url ?? callbackUrl)
    router.refresh()
    return true
  }

  async function startVerificationFlow(email: string, password: string) {
    setPendingVerification({ email, password })
    setVerificationCode('')
    setVerificationMessage('')
    setOnscreenOtp('')
    setVerificationMessage('Dogrulama kodu olusturuluyor...')
  }

  async function onSubmit(data: Form) {
    setServerError('')
    setVerificationMessage('')
    const normalizedEmail = normalizeIucEmail(data.email)

    try {
      const accountStatus = await fetchAccountStatus(normalizedEmail)
      if (!accountStatus.exists) {
        setPendingVerification(null)
        setServerError('Bu e-posta ile kayitli bir hesap bulunamadi')
        return
      }

      if (!accountStatus.is_verified) {
        setServerError('Hesabin kayitli ama e-posta dogrulaman tamamlanmamis. Asagidaki kodla girisi tamamlayabilirsin.')
        await startVerificationFlow(normalizedEmail, data.password)
        if (accountStatus.debug_otp) {
          setOnscreenOtp(accountStatus.debug_otp)
          setVerificationMessage('Ekranda gorunen 6 haneli kodu ayni sekilde gir.')
        } else {
          setVerificationMessage('Dogrulama kodu olusturulamadi. Lutfen tekrar dene.')
        }
        return
      }
    } catch {
      // Hesap durumu kontrolu gecici olarak basarisiz olsa da girisi dene.
    }

    setPendingVerification(null)
    await completeLogin(normalizedEmail, data.password)
  }

  async function handleVerifyAndLogin() {
    if (!pendingVerification || verificationCode.length !== 6) return

    setServerError('')
    setVerificationMessage('')
    setIsVerifyingCode(true)

    try {
      await verifyOTP(pendingVerification.email, verificationCode)
      setVerificationMessage('E-posta dogrulandi. Giris yapiliyor...')
      const loggedIn = await completeLogin(pendingVerification.email, pendingVerification.password)
      if (!loggedIn) {
        setVerificationMessage('')
        setServerError('E-posta dogrulandi ama giris tamamlanamadi. Sifreni tekrar kontrol et.')
      }
    } catch {
      setServerError('Dogrulama kodu hatali veya suresi dolmus.')
    } finally {
      setIsVerifyingCode(false)
    }
  }

  async function handleResendCode() {
    if (!pendingVerification) return
    setIsResendingCode(true)
    await startVerificationFlow(pendingVerification.email, pendingVerification.password)
    try {
      const result = await resendOTP(pendingVerification.email)
      if (!result.debug_otp) {
        throw new Error('OTP code missing')
      }
      setOnscreenOtp(result.debug_otp)
      setVerificationMessage('Ekranda gorunen 6 haneli kodu ayni sekilde gir.')
    } catch {
      setVerificationMessage('Dogrulama kodu olusturulamadi. Lutfen tekrar dene.')
    } finally {
      setIsResendingCode(false)
    }
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

      {pendingVerification ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
          <p className="font-medium">Dogrulama gerekli</p>
          <p className="mt-1 leading-5">
            <span className="font-medium">{pendingVerification.email}</span> icin olusturulan 6 haneli kodu ayni sekilde gir.
          </p>
          {onscreenOtp ? (
            <div className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-3 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-amber-700">
                Ekranda gorunen kod
              </p>
              <p className="mt-2 text-xl font-semibold tracking-[0.34em] text-amber-950">
                {onscreenOtp}
              </p>
            </div>
          ) : null}
          {verificationMessage ? <p className="mt-2 text-[11px]">{verificationMessage}</p> : null}
          <div className="mt-3 flex gap-2">
            <input
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="123456"
              className="h-9 flex-1 rounded-lg border border-amber-300 bg-white px-3 text-sm tracking-[0.2em] text-gray-900 focus:border-[#1E3A5F] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleVerifyAndLogin}
              disabled={verificationCode.length !== 6 || isVerifyingCode}
              className="rounded-lg bg-[#1E3A5F] px-3 text-xs font-medium text-white disabled:opacity-50"
            >
              {isVerifyingCode ? 'Dogrulaniyor...' : 'Dogrula'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleResendCode}
            disabled={isResendingCode}
            className="mt-3 text-[11px] font-medium text-[#1E3A5F] hover:underline disabled:opacity-50"
          >
            {isResendingCode ? 'Kod olusturuluyor...' : 'Kodu yeniden olustur'}
          </button>
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-sm" />}>
      <LoginPageContent />
    </Suspense>
  )
}
