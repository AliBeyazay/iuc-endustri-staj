'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { fetchUserProfile, updateUserProfile, uploadCV } from '@/lib/api'
import { UserProfile } from '@/types'
import { getAvatarColor, getInitials } from '@/lib/helpers'
import ProfileDropdown from '@/components/ProfileDropdown'
import ThemeToggle from '@/components/ThemeToggle'
import UniversityLogo from '@/components/UniversityLogo'

function ProfileEdit({
  profile,
  onSaved,
}: {
  profile: UserProfile
  onSaved: () => void
}) {
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedin_url ?? '')
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      if (cvFile) {
        await uploadCV(cvFile)
      }
      await updateUserProfile({ linkedin_url: linkedinUrl || undefined })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-gray-100 p-3 dark:border-[#d8ad43]/12">
      <div>
        <label className="mb-1 block text-xs text-gray-500 dark:text-[#e7edf4]/50">LinkedIn URL</label>
        <input
          value={linkedinUrl}
          onChange={(event) => setLinkedinUrl(event.target.value)}
          placeholder="https://linkedin.com/in/..."
          className="h-8 w-full rounded border border-gray-200 px-2.5 text-xs focus:border-[#1E3A5F] focus:outline-none dark:border-[#d8ad43]/18 dark:bg-[#0e1e33] dark:text-[#e7edf4] dark:focus:border-[#d8ad43]/40"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500 dark:text-[#e7edf4]/50">
          CV Yükle <span className="text-gray-400 dark:text-[#e7edf4]/35">(PDF, maks 5MB)</span>
        </label>
        <input
          type="file"
          accept=".pdf"
          onChange={(event) => setCvFile(event.target.files?.[0] ?? null)}
          className="text-xs text-gray-500 file:mr-2 file:rounded file:border file:border-gray-200 file:px-2 file:py-1 file:text-xs"
        />
        {profile.cv_url ? (
          <p className="mt-1 text-[10px] text-gray-400">
            Mevcut CV var -{' '}
            <a
              href={profile.cv_url}
              target="_blank"
              rel="noreferrer"
              className="text-[#1E3A5F]"
            >
              Görüntüle
            </a>
          </p>
        ) : null}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="h-8 w-full rounded bg-[#1E3A5F] text-xs text-white disabled:opacity-50 dark:bg-[#d8ad43] dark:text-[#10223b]"
      >
        {saving ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const { status } = useSession()
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [router, status])

  const { data: profileData, mutate: mutateProfile } = useSWR<UserProfile>(
    status === 'authenticated' ? 'profile' : null,
    fetchUserProfile
  )

  const profile = profileData ?? null

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-sm text-gray-500 dark:text-[#e7edf4]/50">
        Profil yükleniyor...
      </div>
    )
  }

  if (status === 'unauthenticated') return null

  return (
    <div className="flex min-h-screen flex-col bg-[#f9f9ff] dark:bg-[#0e1e33]">
      <nav className="sticky top-0 z-30 bg-[#1A233A] shadow-md" style={{ borderBottom: '2px solid transparent', borderImage: 'linear-gradient(to right, #B8860B, #F3E5AB, #B8860B) 1' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-0 sm:px-6" style={{ height: '64px' }}>
          <Link href="/listings" className="flex items-center gap-4">
            <UniversityLogo className="h-10 w-10 shrink-0 rounded border border-[#D4AF37] p-0.5" />
            <div className="min-w-0">
              <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37] sm:text-sm">
                İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA
              </span>
              <p className="truncate text-[9px] tracking-wider text-gray-300 sm:text-xs">
                ENDÜSTRİ MÜHENDİSLİĞİ STAJ PLATFORMU
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-8">
            <div className="hidden items-center gap-8 sm:flex">
              {[
                { label: 'İlanlar', href: '/listings' },
                { label: 'Başvurular', href: '/dashboard' },
                { label: 'Profil', href: '/profile' },
              ].map((nav) => (
                <Link
                  key={nav.href}
                  href={nav.href}
                  className={`text-sm font-medium transition-colors ${
                    nav.href === '/profile'
                      ? 'border-b-2 border-[#D4AF37] pb-1 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {nav.label}
                </Link>
              ))}
            </div>
            <ProfileDropdown />
          </div>
        </div>
      </nav>

      <main className="flex flex-grow flex-col items-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md space-y-6">
          {/* ── Profile Card ── */}
          <section className="campus-card rounded-3xl p-6 sm:p-8">
            <div className="mb-8 flex items-center gap-4">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold shadow-inner ${
                  profile ? getAvatarColor(profile.full_name) : 'bg-gray-100 text-gray-400'
                }`}
              >
                {profile ? getInitials(profile.full_name) : '??'}
              </div>
              <div className="min-w-0">
                <h2 className="campus-heading truncate text-xl font-bold text-[#132843] dark:text-[#e7edf4]">{profile?.full_name ?? '-'}</h2>
                <p className="truncate text-sm text-gray-500 dark:text-[#e7edf4]/50">{profile?.iuc_email ?? '-'}</p>
              </div>
            </div>

            {profile ? (
              <>
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-white/8 dark:bg-white/5">
                    <span className="text-sm font-medium text-gray-600 dark:text-[#e7edf4]/60">Öğrenci No</span>
                    <span className="text-sm font-bold text-[#132843] dark:text-[#e7edf4]">
                      {profile.student_no ?? <span className="font-medium text-gray-400 dark:text-[#e7edf4]/40">Belirtilmedi</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-white/8 dark:bg-white/5">
                    <span className="text-sm font-medium text-gray-600 dark:text-[#e7edf4]/60">Sınıf</span>
                    <span className="text-sm font-bold text-[#132843] dark:text-[#e7edf4]">
                      {profile.department_year
                        ? `${profile.department_year}. Sınıf`
                        : <span className="font-medium text-gray-400 dark:text-[#e7edf4]/40">Belirtilmedi</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-white/8 dark:bg-white/5">
                    <span className="text-sm font-medium text-gray-600 dark:text-[#e7edf4]/60">LinkedIn</span>
                    {profile.linkedin_url ? (
                      <a
                        href={profile.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-bold text-[#132843] hover:text-blue-600 dark:text-[#e7edf4] dark:hover:text-[#d8ad43]"
                      >
                        Profili Gör
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-gray-400 dark:text-[#e7edf4]/40">Belirtilmedi</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-white/8 dark:bg-white/5">
                    <span className="text-sm font-medium text-gray-600 dark:text-[#e7edf4]/60">CV</span>
                    {profile.cv_url ? (
                      <a
                        href={profile.cv_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-bold text-[#132843] hover:text-blue-600 dark:text-[#e7edf4] dark:hover:text-[#d8ad43]"
                      >
                        Görüntüle
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-gray-400 dark:text-[#e7edf4]/40">Yüklenmedi</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-white/8 dark:bg-white/5">
                    <span className="text-sm font-medium text-gray-600 dark:text-[#e7edf4]/60">Durum</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-sm ${
                        profile.is_verified
                          ? 'border-green-200 bg-green-100 text-green-800 dark:border-green-800/30 dark:bg-green-900/30 dark:text-green-300'
                          : 'border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-800/30 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}
                    >
                      {profile.is_verified ? 'Doğrulandı' : 'Doğrulanmadı'}
                    </span>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-[#e7edf4]/70">Profil Tamamlanma</span>
                    <span className="text-sm font-bold text-[#132843] dark:text-[#e7edf4]">%{profile.completion_percentage}</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-gray-200 shadow-inner dark:bg-white/10">
                    <div
                      className="h-2.5 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${profile.completion_percentage}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => setEditOpen(!editOpen)}
                  type="button"
                  className="w-full rounded-xl py-3 px-4 text-sm font-bold text-[#132843] shadow-md transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                  style={{ background: 'linear-gradient(to bottom, #D4AF37, #B8860B)' }}
                >
                  {editOpen ? 'Kapat' : 'Profili Düzenle'}
                </button>
                {editOpen ? (
                  <ProfileEdit
                    profile={profile}
                    onSaved={() => {
                      mutateProfile()
                      setEditOpen(false)
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </section>

          {/* ── Dark Mode Toggle ── */}
          <section className="campus-card flex cursor-pointer items-center justify-between rounded-3xl p-6 transition-colors">
            <div>
              <h3 className="campus-heading text-lg font-bold text-[#132843] dark:text-[#e7edf4]">Gece Modu</h3>
              <p className="text-sm text-gray-500 dark:text-[#e7edf4]/50">Koyu temayı aç veya kapat</p>
            </div>
            <ThemeToggle />
          </section>

          {/* ── Newsletter ── */}
          <section className="campus-card rounded-3xl p-6">
            <h3 className="campus-heading mb-1 text-lg font-bold text-[#132843] dark:text-[#e7edf4]">İlanlardan İlk Sen Haberdar Ol</h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-[#e7edf4]/50">Yeni ilanlardan anında haberdar olmak için abone ol.</p>
            <div className="flex">
              <input
                type="email"
                placeholder="E-posta adresiniz"
                className="min-w-0 flex-auto rounded-l-xl border-0 px-4 py-3 text-sm text-[#132843] shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#D4AF37] dark:bg-[#0e1e33] dark:text-[#e7edf4] dark:ring-white/10 dark:placeholder:text-[#e7edf4]/30"
                style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}
              />
              <button
                type="button"
                className="flex-none rounded-r-xl px-6 py-3 text-sm font-bold text-[#132843] shadow-sm transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(to bottom, #D4AF37, #B8860B)' }}
              >
                ABONE OL
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
