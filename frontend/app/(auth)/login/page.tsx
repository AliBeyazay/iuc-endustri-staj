'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSession, signIn } from 'next-auth/react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { fetchAccountStatus, normalizeIucEmail, resendOTP, verifyOTP } from '@/lib/api'

const schema = z.object({
  email: z.string().email('Geçerli bir e-posta girin.'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı.'),
})

type Form = z.infer<typeof schema>

const ERROR_MAP: Record<string, string> = {
  CredentialsSignin: 'E-posta veya şifre hatalı',
  NotIUCEmail: 'Sadece @ogr.iuc.edu.tr veya @iuc.edu.tr adresleri kabul edilir',
  OAuthAccountNotLinked: 'Bu e-posta başka bir yöntemle kayıtlı',
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
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
    try {
      const response = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      })

      if (response?.error) {
        setServerError(ERROR_MAP[response.error] ?? 'Bir hata oluştu, tekrar deneyin')
        return false
      }

      if (!response?.ok) {
        setServerError('Giriş tamamlanamadı. Bilgilerini kontrol edip tekrar dene.')
        return false
      }

      setStatusMessage('Giriş başarılı. Yönlendiriliyorsun...')

      const session = await getSession()
      if (session?.access_token) {
        document.cookie = `access_token=${encodeURIComponent(session.access_token)}; Path=/; SameSite=Lax`
      }

      window.location.assign(response?.url ?? callbackUrl)
      return true
    } catch {
      setServerError('Giriş isteği başarısız oldu. Lütfen biraz sonra tekrar dene.')
      return false
    }
  }

  async function startVerificationFlow(email: string, password: string) {
    setPendingVerification({ email, password })
    setVerificationCode('')
    setVerificationMessage('')
    setOnscreenOtp('')
    setVerificationMessage('Doğrulama kodu oluşturuluyor...')
  }

  async function loadVisibleOtp(email: string) {
    try {
      const result = await resendOTP(email)
      if (!result.debug_otp) {
        throw new Error('OTP code missing')
      }
      setOnscreenOtp(result.debug_otp)
      setVerificationMessage('Ekranda görünen 6 haneli kodu aynı şekilde gir.')
      return true
    } catch {
      setVerificationMessage('Doğrulama kodu oluşturulamadı. Lütfen tekrar dene.')
      return false
    }
  }

  async function onSubmit(data: Form) {
    setServerError('')
    setStatusMessage('Bilgiler kontrol ediliyor...')
    setVerificationMessage('')
    const normalizedEmail = normalizeIucEmail(data.email)

    try {
      const accountStatus = await fetchAccountStatus(normalizedEmail)
      if (!accountStatus.exists) {
        setPendingVerification(null)
        setStatusMessage('')
        setServerError('Bu e-posta ile kayıtlı bir hesap bulunamadı')
        return
      }

      if (!accountStatus.is_verified) {
        setStatusMessage('')
        setServerError('Hesabın kayıtlı ama e-posta doğrulaman tamamlanmamış. Aşağıdaki kodla girişi tamamlayabilirsin.')
        await startVerificationFlow(normalizedEmail, data.password)
        if (accountStatus.debug_otp) {
          setOnscreenOtp(accountStatus.debug_otp)
          setVerificationMessage('Ekranda görünen 6 haneli kodu aynı şekilde gir.')
        } else {
          await loadVisibleOtp(normalizedEmail)
        }
        return
      }
    } catch {
      setStatusMessage('Hesap durumu kontrol edilemedi, doğrudan giriş deneniyor...')
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
      setVerificationMessage('E-posta doğrulandı. Giriş yapılıyor...')
      const loggedIn = await completeLogin(pendingVerification.email, pendingVerification.password)
      if (!loggedIn) {
        setVerificationMessage('')
        setServerError('E-posta doğrulandı ama giriş tamamlanamadı. Şifreni tekrar kontrol et.')
      }
    } catch {
      setServerError('Doğrulama kodu hatalı veya süresi dolmuş.')
    } finally {
      setIsVerifyingCode(false)
    }
  }

  async function handleResendCode() {
    if (!pendingVerification) return
    setIsResendingCode(true)
    await startVerificationFlow(pendingVerification.email, pendingVerification.password)
    await loadVisibleOtp(pendingVerification.email)
    setIsResendingCode(false)
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-1 text-xl font-medium text-gray-900 dark:text-[#e7edf4]">Giriş Yap</h1>
      <p className="mb-5 text-sm text-gray-500 dark:text-[#e7edf4]/50">IUC öğrenci hesabınla devam et</p>

      {registered ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          Kaydınız başarıyla oluşturuldu.
        </div>
      ) : null}

      {statusMessage ? (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
          {statusMessage}
        </div>
      ) : null}

      {serverError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          {serverError}
        </div>
      ) : null}

      {pendingVerification ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
          <p className="font-medium">Doğrulama gerekli</p>
          <p className="mt-1 leading-5">
            <span className="font-medium">{pendingVerification.email}</span> için oluşturulan 6 haneli kodu aynı şekilde gir.
          </p>
          {onscreenOtp ? (
            <div className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-3 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-amber-700">
                Ekranda görünen kod
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
              {isVerifyingCode ? 'Doğrulanıyor...' : 'Doğrula'}
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
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-[#e7edf4]/60">E-posta</label>
          <input
            {...register('email')}
            type="email"
            placeholder="ornek@ogr.iuc.edu.tr"
            className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-[#1E3A5F] focus:outline-none dark:border-[#d8ad43]/18 dark:bg-[#0e1e33] dark:text-[#e7edf4] dark:focus:border-[#d8ad43]/40"
          />
          {errors.email ? <p className="mt-1 text-[10px] text-red-500">{errors.email.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-[#e7edf4]/60">Şifre</label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              className="h-9 w-full rounded-lg border border-gray-200 px-3 pr-8 text-sm focus:border-[#1E3A5F] focus:outline-none dark:border-[#d8ad43]/18 dark:bg-[#0e1e33] dark:text-[#e7edf4] dark:focus:border-[#d8ad43]/40"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400"
            >
              {showPassword ? 'Gizle' : 'Göster'}
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
            Şifremi unuttum
          </button>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-10 w-full rounded-lg bg-[#1E3A5F] text-sm font-medium text-white disabled:opacity-50 dark:bg-[#d8ad43] dark:text-[#10223b]"
        >
          {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-gray-400 dark:text-[#e7edf4]/40">
        Hesabın yok mu?{' '}
        <button
          onClick={() => router.push('/register')}
          className="font-medium text-[#1E3A5F] hover:underline dark:text-[#d8ad43]"
        >
          Kayıt Ol
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
