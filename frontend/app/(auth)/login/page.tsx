'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSession, signIn } from 'next-auth/react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { fetchAccountStatus, normalizeIucEmail, resendOTP, verifyOTP } from '@/lib/api'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

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
    <div className="w-full">
      <div className="mb-10 text-center md:text-left">
        <h3 className="text-[#051c38] dark:text-white text-3xl font-bold campus-heading mb-2">Giriş Yap</h3>
        <p className="text-[#44474d] dark:text-white/50 text-sm">Devam etmek için kurumsal bilgilerinizle giriş yapın.</p>
      </div>

      {registered ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          Kaydınız başarıyla oluşturuldu.
        </div>
      ) : null}

      {statusMessage ? (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          {statusMessage}
        </div>
      ) : null}

      {serverError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {serverError}
        </div>
      ) : null}

      {pendingVerification ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-xs text-amber-900">
          <p className="font-medium">Doğrulama gerekli</p>
          <p className="mt-1 leading-5">
            <span className="font-medium">{pendingVerification.email}</span> için oluşturulan 6 haneli kodu aynı şekilde gir.
          </p>
          {onscreenOtp ? (
            <div className="mt-3 rounded-xl border border-amber-300 bg-white px-4 py-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
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
              className="h-10 flex-1 rounded-xl border border-amber-300 bg-white px-4 text-sm tracking-[0.2em] text-gray-900 focus:border-[#051c38] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleVerifyAndLogin}
              disabled={verificationCode.length !== 6 || isVerifyingCode}
              className="rounded-xl bg-[#051c38] px-4 text-xs font-medium text-white disabled:opacity-50"
            >
              {isVerifyingCode ? 'Doğrulanıyor...' : 'Doğrula'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleResendCode}
            disabled={isResendingCode}
            className="mt-3 text-[11px] font-medium text-[#051c38] hover:underline disabled:opacity-50"
          >
            {isResendingCode ? 'Kod oluşturuluyor...' : 'Kodu yeniden oluştur'}
          </button>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-[#051c38] dark:text-white text-xs font-bold uppercase tracking-wider" htmlFor="email">E-posta</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#051c38]/40 dark:text-white/30" size={18} />
            <input
              {...register('email')}
              type="email"
              id="email"
              placeholder="isim.soyisim@ogr.iuc.edu.tr"
              className="w-full pl-12 pr-4 py-4 bg-[#e7eeff] dark:bg-[#1d314e] border-none rounded-xl text-sm text-[#051c38] dark:text-white placeholder:text-[#051c38]/30 dark:placeholder:text-white/25 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#d8ad43] transition-all"
            />
          </div>
          {errors.email ? <p className="text-[10px] text-red-500">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <label className="block text-[#051c38] dark:text-white text-xs font-bold uppercase tracking-wider" htmlFor="password">Şifre</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#051c38]/40 dark:text-white/30" size={18} />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              id="password"
              placeholder="••••••••"
              className="w-full pl-12 pr-12 py-4 bg-[#e7eeff] dark:bg-[#1d314e] border-none rounded-xl text-sm text-[#051c38] dark:text-white placeholder:text-[#051c38]/30 dark:placeholder:text-white/25 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#d8ad43] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#051c38]/40 dark:text-white/30 hover:text-[#051c38] dark:hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password ? (
            <p className="text-[10px] text-red-500">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between py-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="rounded border-[#c4c6ce] text-[#d8ad43] focus:ring-[#d8ad43]/20 h-5 w-5"
            />
            <span className="text-sm text-[#44474d] dark:text-white/60 font-medium group-hover:text-[#051c38] dark:group-hover:text-white transition-colors">Beni Hatırla</span>
          </label>
          <button
            type="button"
            onClick={() => router.push('/forgot-password')}
            className="text-sm font-semibold text-[#d8ad43] hover:text-[#c79828] transition-colors"
          >
            Şifremi Unuttum
          </button>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#051c38] dark:bg-[#d8ad43] hover:bg-[#1d314e] dark:hover:bg-[#e4c05c] text-white dark:text-[#10223b] font-bold py-4 rounded-xl shadow-lg shadow-[#051c38]/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
        >
          <span>{isSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}</span>
          {!isSubmitting && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
        </button>
      </form>

      <div className="mt-12 text-center">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-px flex-grow bg-[#c4c6ce]/30" />
          <span className="text-[#44474d]/50 dark:text-white/30 text-xs font-bold uppercase tracking-widest">veya</span>
          <div className="h-px flex-grow bg-[#c4c6ce]/30" />
        </div>
        <p className="text-[#44474d] dark:text-white/60 text-sm mb-4">Henüz bir hesabınız yok mu?</p>
        <button
          onClick={() => router.push('/register')}
          className="inline-flex items-center justify-center px-8 py-3 rounded-full border-2 border-[#c4c6ce] dark:border-white/20 text-[#051c38] dark:text-white font-bold text-sm hover:bg-[#f0f3ff] dark:hover:bg-white/5 transition-colors"
        >
          Hesap Oluştur / Kayıt Ol
        </button>
      </div>
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
