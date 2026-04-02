'use client'

import type { ClipboardEvent, KeyboardEvent } from 'react'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  checkEmailAvailable,
  fetchAccountStatus,
  registerUser,
  resendOTP,
  verifyOTP,
} from '@/lib/api'

const step1Schema = z.object({
  full_name: z.string().min(3, 'Ad soyad en az 3 karakter olmalı.'),
  email: z.string().email().refine(
    (value) => value.endsWith('@ogr.iuc.edu.tr') || value.endsWith('@iuc.edu.tr'),
    'Sadece @ogr.iuc.edu.tr veya @iuc.edu.tr uzantılı e-posta kabul edilir.'
  ),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı.'),
  password_confirm: z.string(),
}).refine((data) => data.password === data.password_confirm, {
  message: 'Şifreler eşleşmiyor.',
  path: ['password_confirm'],
})

const step2Schema = z.object({
  student_no: z.string().regex(/^\d{10}$/, 'Öğrenci numarası 10 haneli olmalı.'),
  department_year: z.number().min(1).max(4),
  linkedin_url: z.string().url('Geçersiz LinkedIn adresi.').optional().or(z.literal('')),
})

type Step1 = z.infer<typeof step1Schema>
type Step2 = z.infer<typeof step2Schema>

type RegisterResponse = {
  delivery_method?: string
  debug_otp?: string
}

function OTPInput({
  hasError,
  onComplete,
}: {
  hasError: boolean
  onComplete: (otp: string) => void
}) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null))

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return

    const nextDigits = [...digits]
    nextDigits[index] = value
    setDigits(nextDigits)

    if (value && index < refs.length - 1) {
      refs[index + 1].current?.focus()
    }

    if (nextDigits.every(Boolean)) {
      onComplete(nextDigits.join(''))
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      refs[index - 1].current?.focus()
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const nextDigits = pasted.split('').concat(Array(6).fill('')).slice(0, 6)
    setDigits(nextDigits)

    if (pasted.length === 6) {
      onComplete(pasted)
    }

    refs[Math.min(pasted.length, 5)].current?.focus()
  }

  return (
    <div className="my-4 flex justify-center gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={refs[index]}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          maxLength={1}
          className={`h-12 w-10 rounded-lg border text-center text-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 dark:focus:ring-[#d8ad43]/20 ${
            digit ? 'border-[#1E3A5F] bg-blue-50 text-[#0C447C] dark:border-[#d8ad43] dark:bg-[#d8ad43]/10 dark:text-[#d8ad43]' : 'border-gray-200 bg-gray-50 dark:border-[#d8ad43]/18 dark:bg-[#0e1e33]'
          } ${hasError ? 'border-red-400 bg-red-50 animate-pulse' : ''}`}
        />
      ))}
    </div>
  )
}

function extractRegisterConflictMessage(message: string, email: string) {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('e-posta') && (lowerMessage.includes('zaten kayitli') || lowerMessage.includes('zaten kayıtlı'))) {
    return `${email} adresi zaten kayıtlı. Giriş ekranından devam etmen gerekiyor.`
  }

  if (
    (lowerMessage.includes('ogrenci numarasi') || lowerMessage.includes('öğrenci numarası')) &&
    (lowerMessage.includes('zaten kayitli') || lowerMessage.includes('zaten kayıtlı'))
  ) {
    return 'Bu öğrenci numarası başka bir hesapta kayıtlı görünüyor.'
  }

  if (lowerMessage.includes('request failed with status 400')) {
    return `${email} için kayıt isteği reddedildi. Hesap zaten oluşmuş olabilir; giriş ekranından devam etmeyi dene.`
  }

  return message
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [step1Data, setStep1Data] = useState<Step1 | null>(null)
  const [otpError, setOtpError] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [selectedYear, setSelectedYear] = useState(3)
  const [onscreenOtp, setOnscreenOtp] = useState('')
  const [step2Error, setStep2Error] = useState('')
  const [step1Error, setStep1Error] = useState('')
  const [step1Status, setStep1Status] = useState('')
  const [step1Info, setStep1Info] = useState('')
  const [existingUnverifiedEmail, setExistingUnverifiedEmail] = useState('')

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema) })
  const form2 = useForm<Step2>({
    resolver: zodResolver(step2Schema),
    defaultValues: { department_year: 3, linkedin_url: '' },
  })

  function applyRegisterResponse(result: RegisterResponse) {
    setOnscreenOtp(result.debug_otp ?? '')
  }

  async function onStep1(data: Step1) {
    setStep1Error('')
    setStep1Status('E-posta durumu kontrol ediliyor...')
    setStep2Error('')
    setStep1Info('')
    setExistingUnverifiedEmail('')

    try {
      const accountStatus = await fetchAccountStatus(data.email)
      if (accountStatus.exists) {
        setStep1Status('')
        if (accountStatus.is_verified) {
          form1.setError('email', { message: 'Bu e-posta zaten kayıtlı.' })
        } else {
          setExistingUnverifiedEmail(data.email)
          form1.setError('email', {
            message: 'Bu hesap kayıtlı ama e-posta doğrulaması tamamlanmamış.',
          })
          setStep1Info('Giriş ekranına geçip doğrulama kodunu yeniden oluşturabilirsin.')
        }
        return
      }

      setStep1Status('Kayıt için e-posta uygunluğu kontrol ediliyor...')
      const available = await checkEmailAvailable(data.email)
      if (!available) {
        setStep1Status('')
        form1.setError('email', { message: 'Bu e-posta zaten kayıtlı.' })
        return
      }

      setStep1Status('')
      setStep1Data(data)
      setStep(2)
    } catch (error) {
      setStep1Status('')
      setStep1Error('')
      setStep2Error(
        error instanceof Error && error.message
          ? `On kontrol atlandi: ${error.message}`
          : 'On kontrol atlandi. Bilgileri girip devam edebilirsin.',
      )
      setStep1Data(data)
      setStep(2)
    }
  }

  async function onStep2(data: Step2) {
    if (!step1Data) return

    setStep2Error('')

    try {
      const result = await registerUser({
        full_name: step1Data.full_name,
        email: step1Data.email,
        password: step1Data.password,
        student_no: data.student_no,
        department_year: data.department_year,
        linkedin_url: data.linkedin_url || undefined,
      })
      if (!result.debug_otp) {
        throw new Error('OTP code missing')
      }

      applyRegisterResponse(result)
      startResendTimer()
      setStep(3)
    } catch (error) {
      try {
        const result = await resendOTP(step1Data.email)
        applyRegisterResponse(result)
        startResendTimer()
        setStep2Error('')
        setStep(3)
        return
      } catch {
        try {
          const accountStatus = await fetchAccountStatus(step1Data.email)
          if (accountStatus.exists && !accountStatus.is_verified) {
            if (accountStatus.debug_otp) {
              applyRegisterResponse(accountStatus)
            } else {
              const result = await resendOTP(step1Data.email)
              applyRegisterResponse(result)
            }
            startResendTimer()
            setStep2Error('')
            setStep(3)
            return
          }
        } catch {
          // Continue to surface the original error below.
        }
      }

      setStep2Error(
        error instanceof Error && error.message
          ? extractRegisterConflictMessage(error.message, step1Data.email)
          : 'Profil bilgileri kaydedilemedi. Alanları kontrol edip tekrar dene.',
      )
    }
  }

  async function onOTPComplete(otp: string) {
    if (!step1Data) return

    setOtpError(false)

    try {
      await verifyOTP(step1Data.email, otp)
      setStep(4)
    } catch {
      setOtpError(true)
    }
  }

  function startResendTimer() {
    setResendCountdown(60)
    const interval = setInterval(() => {
      setResendCountdown((value) => {
        if (value <= 1) {
          clearInterval(interval)
          return 0
        }
        return value - 1
      })
    }, 1000)
  }

  async function handleResend() {
    if (!step1Data) return
    try {
      const result = await resendOTP(step1Data.email)
      if (!result.debug_otp) {
        throw new Error('OTP code missing')
      }
      applyRegisterResponse(result)
      setOtpError(false)
      startResendTimer()
    } catch {
      setOtpError(true)
    }
  }

  function Dots() {
    return (
      <div className="mb-5 flex justify-center gap-1.5">
        {[1, 2, 3, 4].map((value) => (
          <div
            key={value}
            className={`h-1.5 rounded-full transition-all ${
              value === step ? 'w-4 bg-[#1E3A5F] dark:bg-[#d8ad43]' : 'w-1.5 bg-gray-200 dark:bg-white/15'
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <Dots />

      {step === 1 && (
        <>
          <h1 className="mb-1 text-xl font-medium text-gray-900 dark:text-[#e7edf4]">Hesap Oluştur</h1>
          <p className="mb-5 text-sm text-gray-500 dark:text-[#e7edf4]/50">Adım 1/3 - Temel bilgiler</p>

          {step1Status ? (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
              {step1Status}
            </div>
          ) : null}

          {step1Error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              {step1Error}
            </div>
          ) : null}

          <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-3">
            {[
              { name: 'full_name' as const, label: 'Ad Soyad', type: 'text', placeholder: 'Ahmet Yilmaz' },
              {
                name: 'email' as const,
                label: 'IUC Öğrenci E-postası',
                type: 'email',
                placeholder: 'ahmet@ogr.iuc.edu.tr',
                hint: '@ogr.iuc.edu.tr veya @iuc.edu.tr uzantılı adres giriniz',
              },
              { name: 'password' as const, label: 'Şifre', type: 'password', placeholder: '' },
              { name: 'password_confirm' as const, label: 'Şifre Tekrar', type: 'password', placeholder: '' },
            ].map(({ hint, label, name, placeholder, type }) => (
              <div key={name}>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-[#e7edf4]/60">{label}</label>
                <input
                  {...form1.register(name)}
                  type={type}
                  placeholder={placeholder}
                  className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-[#1E3A5F] focus:outline-none dark:border-[#d8ad43]/18 dark:bg-[#0e1e33] dark:text-[#e7edf4] dark:focus:border-[#d8ad43]/40"
                />
                {hint ? <p className="mt-1 text-[10px] text-gray-400">{hint}</p> : null}
                {form1.formState.errors[name] ? (
                  <p className="mt-1 text-[10px] text-red-500">
                    {form1.formState.errors[name]?.message}
                  </p>
                ) : null}
              </div>
            ))}

            <button
              type="submit"
              disabled={form1.formState.isSubmitting}
              className="h-10 w-full rounded-lg bg-[#1E3A5F] text-sm font-medium text-white transition-all duration-200 hover:bg-[#15304f] hover:shadow-campus-sm disabled:opacity-50 dark:bg-[#d8ad43] dark:text-[#10223b] dark:hover:bg-[#e4c05c]"
            >
              {form1.formState.isSubmitting ? 'Kontrol ediliyor...' : 'Devam Et ->'}
            </button>
          </form>

          {step1Info ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
              <p>{step1Info}</p>
              {existingUnverifiedEmail ? (
                <button
                  type="button"
                  onClick={() => router.push(`/login?email=${encodeURIComponent(existingUnverifiedEmail)}`)}
                  className="mt-2 font-medium text-[#1E3A5F] hover:underline"
                >
                  Giriş ekranına git
                </button>
              ) : null}
            </div>
          ) : null}

          <p className="mt-4 text-center text-xs text-gray-400 dark:text-[#e7edf4]/40">
            Zaten hesabın var mı?{' '}
            <button
              onClick={() => router.push('/login')}
              className="font-medium text-[#1E3A5F] hover:underline dark:text-[#d8ad43]"
            >
              Giriş Yap
            </button>
          </p>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="mb-1 text-xl font-medium text-gray-900 dark:text-[#e7edf4]">Öğrenci Bilgileri</h1>
          <p className="mb-5 text-sm text-gray-500 dark:text-[#e7edf4]/50">Adım 2/3 - Profil kurulumu</p>

          <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-[#e7edf4]/60">Öğrenci Numarası</label>
              <input
                {...form2.register('student_no')}
                type="text"
                placeholder="0401210045"
                maxLength={10}
                className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm transition-all duration-200 focus:border-[#1E3A5F] focus:shadow-[0_0_16px_rgba(30,58,95,0.08)] focus:outline-none dark:border-[#d8ad43]/18 dark:bg-[#0e1e33] dark:text-[#e7edf4] dark:focus:border-[#d8ad43]/40 dark:focus:shadow-[0_0_16px_rgba(216,173,67,0.06)]"
              />
              {form2.formState.errors.student_no ? (
                <p className="mt-1 text-[10px] text-red-500">
                  {form2.formState.errors.student_no.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-gray-600 dark:text-[#e7edf4]/60">Sınıf</label>
              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setSelectedYear(year)
                      form2.setValue('department_year', year, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }}
                    className={`rounded-lg border py-1.5 text-xs transition-colors ${
                      selectedYear === year
                        ? 'border-[#1E3A5F] bg-blue-50 font-medium text-[#1E3A5F] dark:border-[#d8ad43] dark:bg-[#d8ad43]/15 dark:text-[#d8ad43]'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-[#d8ad43]/18 dark:text-[#e7edf4]/50 dark:hover:border-[#d8ad43]/30'
                    }`}
                  >
                    {year}. Sınıf
                  </button>
                ))}
              </div>
              <input type="hidden" {...form2.register('department_year', { valueAsNumber: true })} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-[#e7edf4]/60">
                LinkedIn <span className="font-normal text-gray-400 dark:text-[#e7edf4]/35">(opsiyonel)</span>
              </label>
              <input
                {...form2.register('linkedin_url')}
                type="url"
                placeholder="https://linkedin.com/in/..."
                className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm transition-all duration-200 focus:border-[#1E3A5F] focus:shadow-[0_0_16px_rgba(30,58,95,0.08)] focus:outline-none dark:border-[#d8ad43]/18 dark:bg-[#0e1e33] dark:text-[#e7edf4] dark:focus:border-[#d8ad43]/40 dark:focus:shadow-[0_0_16px_rgba(216,173,67,0.06)]"
              />
              {form2.formState.errors.linkedin_url ? (
                <p className="mt-1 text-[10px] text-red-500">
                  {form2.formState.errors.linkedin_url.message}
                </p>
              ) : null}
            </div>

            {step2Error ? (
              <div className="space-y-2">
                <p className="text-[11px] text-red-500">{step2Error}</p>
                <button
                  type="button"
                  onClick={() => router.push(`/login?email=${encodeURIComponent(step1Data?.email ?? '')}`)}
                  className="text-[11px] font-medium text-[#1E3A5F] hover:underline"
                >
                  Giriş ekranına git
                </button>
              </div>
            ) : null}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-9 flex-1 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 dark:border-[#d8ad43]/18 dark:text-[#e7edf4]/50 dark:hover:bg-white/5"
              >
                {'<-'} Geri
              </button>
              <button
                type="submit"
                disabled={form2.formState.isSubmitting}
                className="h-9 flex-[2] rounded-lg bg-[#1E3A5F] text-sm font-medium text-white transition-all duration-200 hover:bg-[#15304f] hover:shadow-campus-sm disabled:opacity-50 dark:bg-[#d8ad43] dark:text-[#10223b] dark:hover:bg-[#e4c05c]"
              >
                {form2.formState.isSubmitting ? 'Kaydediliyor...' : 'Devam Et ->'}
              </button>
            </div>
          </form>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="mb-1 text-xl font-medium text-gray-900 dark:text-[#e7edf4]">Doğrulama Kodunu Gir</h1>
          <p className="mb-5 text-sm text-gray-500 dark:text-[#e7edf4]/50">Adım 3/3 - Hesap aktivasyonu</p>

          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
            <p className="mb-1 text-sm font-medium text-blue-800">Kod Hazır</p>
            <p className="text-xs leading-relaxed text-blue-600">
              Aşağıdaki 6 haneli doğrulama kodunu kutulara doğru şekilde gir.
            </p>
          </div>

          {onscreenOtp ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-sm font-medium text-amber-900">Ekranda görünen kod</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                Ekranda görünen 6 haneli kodu alttaki kutulara aynı şekilde yaz.
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-[0.35em] text-amber-950">
                {onscreenOtp}
              </p>
            </div>
          ) : null}

          <OTPInput onComplete={onOTPComplete} hasError={otpError} />

          {otpError ? (
            <p className="mb-3 text-center text-xs text-red-500">Kod hatalı veya süresi dolmuş.</p>
          ) : null}

          <p className="mt-2 text-center text-xs text-gray-400 dark:text-[#e7edf4]/40">
            Yeni kod ister misin?{' '}
            {resendCountdown > 0 ? (
              <span className="text-gray-400">{resendCountdown}s sonra tekrar oluştur</span>
            ) : (
              <button onClick={handleResend} className="font-medium text-[#1E3A5F] hover:underline">
                Yeni Kod Oluştur
              </button>
            )}
          </p>
        </>
      )}

      {step === 4 && (
        <>
          <h1 className="mb-1 text-xl font-medium text-gray-900 dark:text-[#e7edf4]">Kayıt Tamamlandı</h1>
          <p className="mb-5 text-sm text-gray-500 dark:text-[#e7edf4]/50">Hesabın başarıyla oluşturuldu.</p>

          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-base font-semibold text-emerald-800">
              Kaydınız başarıyla oluşturuldu
            </p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-700">
              Artık giriş yaparak platformu kullanabilirsin.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/login?registered=1')}
            className="h-10 w-full rounded-lg bg-[#1E3A5F] text-sm font-medium text-white dark:bg-[#d8ad43] dark:text-[#10223b]"
          >
            Giriş Yap
          </button>
        </>
      )}
    </div>
  )
}
