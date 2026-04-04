'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { fetchNotificationPreferences, fetchUserProfile, updateNotificationPreferences, updateUserProfile, uploadCV } from '@/lib/api'
import { EMFocusArea, NotificationPreferences, UserProfile } from '@/types'
import { getAvatarColor, getInitials, FOCUS_AREA_LABELS } from '@/lib/helpers'
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
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [router, status])

  const { data: profileData, mutate: mutateProfile } = useSWR<UserProfile>(
    status === 'authenticated' ? 'profile' : null,
    fetchUserProfile
  )

  const { data: notifPrefs, mutate: mutateNotifPrefs } = useSWR<NotificationPreferences>(
    status === 'authenticated' ? 'notif-prefs' : null,
    fetchNotificationPreferences
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
    <div className="flex min-h-screen flex-col bg-[#f9f9ff]">
      <nav className="sticky top-0 z-30 flex items-center justify-between bg-[#132843] px-4 py-3 shadow-md sm:px-6">
        <Link href="/listings" className="flex items-center gap-3">
          <UniversityLogo className="h-10 w-10 shrink-0 sm:h-11 sm:w-11" />
          <div className="hidden sm:block">
            <span className="campus-brand block text-sm leading-tight sm:text-lg">
              {'İstanbul Üniversitesi-Cerrahpaşa'}
            </span>
            <p className="text-[8px] uppercase tracking-[0.15em] text-[#f4e3b3]/80 sm:text-[10px]">
              {'Endüstri Mühendisliği Staj Platformu'}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-1 sm:flex">
            {[
              { label: 'İlanlar', href: '/listings' },
              { label: 'Başvurular', href: '/dashboard' },
              { label: 'Profil', href: '/profile' },
            ].map((nav) => (
              <Link
                key={nav.href}
                href={nav.href}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {nav.label}
              </Link>
            ))}
          </div>
          <ProfileDropdown />
        </div>
      </nav>

      <div className="mx-auto max-w-lg px-3 py-6 sm:px-4">
        <div className="campus-card rounded-2xl p-5">
          <div className="mb-5 flex items-center gap-3">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold ${
                profile ? getAvatarColor(profile.full_name) : 'bg-gray-100 text-gray-400'
              }`}
            >
              {profile ? getInitials(profile.full_name) : '??'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-gray-800 dark:text-[#e7edf4]">{profile?.full_name ?? '-'}</p>
              <p className="truncate text-xs text-gray-400 dark:text-[#e7edf4]/40">{profile?.iuc_email ?? '-'}</p>
            </div>
          </div>

          {profile ? (
            <>
              <div className="mb-4 space-y-2.5">
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-white/5">
                  <span className="text-xs text-gray-500 dark:text-[#e7edf4]/50">Öğrenci No</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-[#e7edf4]">
                    {profile.student_no ?? <span className="text-gray-300">Belirtilmedi</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-white/5">
                  <span className="text-xs text-gray-500 dark:text-[#e7edf4]/50">Sınıf</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-[#e7edf4]">
                    {profile.department_year
                      ? `${profile.department_year}. Sınıf`
                      : <span className="text-gray-300">Belirtilmedi</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-white/5">
                  <span className="text-xs text-gray-500 dark:text-[#e7edf4]/50">LinkedIn</span>
                  {profile.linkedin_url ? (
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs font-medium text-[#1E3A5F] hover:underline"
                    >
                      Profili Gör
                    </a>
                  ) : (
                    <span className="text-xs text-gray-300">Belirtilmedi</span>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-white/5">
                  <span className="text-xs text-gray-500 dark:text-[#e7edf4]/50">CV</span>
                  {profile.cv_url ? (
                    <a
                      href={profile.cv_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-[#1E3A5F] hover:underline"
                    >
                      Görüntüle
                    </a>
                  ) : (
                    <span className="text-xs text-gray-300">Yüklenmedi</span>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-white/5">
                  <span className="text-xs text-gray-500 dark:text-[#e7edf4]/50">Durum</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      profile.is_verified
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {profile.is_verified ? 'Doğrulandı' : 'Doğrulanmadı'}
                  </span>
                </div>
              </div>

              <div className="mb-2 flex justify-between text-xs">
                <span className="text-gray-500 dark:text-[#e7edf4]/50">Profil tamamlanma</span>
                <span className="font-medium text-[#1E3A5F] dark:text-[#d8ad43]">%{profile.completion_percentage}</span>
              </div>
              <div className="mb-4 h-1.5 rounded-full bg-gray-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-[#1E3A5F] transition-all dark:bg-[#d8ad43]"
                  style={{ width: `${profile.completion_percentage}%` }}
                />
              </div>

              <button
                onClick={() => setEditOpen(!editOpen)}
                className="w-full rounded-lg border border-gray-200 py-2 text-xs text-gray-500 hover:bg-gray-50 dark:border-[#d8ad43]/18 dark:text-[#e7edf4]/50 dark:hover:bg-white/5"
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
        </div>

        {/* ── Görünüm ── */}
        <div className="campus-card mt-4 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#132843] dark:text-[#e7edf4]">Gece Modu</h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-[#e7edf4]/40">Koyu temayı aç veya kapat</p>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* ── Bildirim Ayarları ── */}
        <div className="campus-card mt-4 rounded-2xl p-5">
          <button onClick={() => setNotifOpen(!notifOpen)} className="flex w-full items-center justify-between">
            <h2 className="text-base font-bold text-[#132843] dark:text-[#e7edf4]">Bildirim Ayarları</h2>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform ${notifOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <p className="mt-1 text-xs text-gray-400 dark:text-[#e7edf4]/40">Haftalık e-posta ile yeni ilanlardan haberdar ol</p>

          {notifOpen && (
            <div className="mt-5 space-y-5">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-white/5">
                <span className="text-sm font-medium text-[#132843] dark:text-[#e7edf4]">E-posta bildirimleri</span>
                <button
                  onClick={async () => {
                    const current = notifPrefs ?? { enabled: false, sectors: [], locations: [] }
                    const updated = { ...current, enabled: !current.enabled }
                    await updateNotificationPreferences(updated)
                    mutateNotifPrefs(updated, false)
                  }}
                  className={`relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                    notifPrefs?.enabled ? 'bg-[#132843]' : 'bg-gray-300'
                  }`}
                >
                  <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${notifPrefs?.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div>
                <p className="mb-3 text-sm font-bold text-[#132843] dark:text-[#e7edf4]">Sektörler</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(FOCUS_AREA_LABELS).map(([key, label]) => {
                    const selected = notifPrefs?.sectors?.includes(key as EMFocusArea) ?? false
                    return (
                      <button
                        key={key}
                        onClick={async () => {
                          const current = notifPrefs ?? { enabled: false, sectors: [], locations: [] }
                          const sectors = selected
                            ? current.sectors.filter((s) => s !== key)
                            : [...current.sectors, key as EMFocusArea]
                          const updated = { ...current, sectors }
                          await updateNotificationPreferences(updated)
                          mutateNotifPrefs(updated, false)
                        }}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                          selected ? 'bg-[#132843] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-[#d8ad43]/18 dark:bg-white/5 dark:text-[#e7edf4]/70'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Newsletter ── */}
        <div className="campus-card mt-4 rounded-2xl p-5">
          <h2 className="text-base font-bold text-[#132843] dark:text-[#e7edf4]">İlanlardan İlk Sen Haberdar Ol</h2>
          <p className="mt-1 text-xs text-gray-400 dark:text-[#e7edf4]/40">Yeni ilanlardan anında haberdar olmak için abone ol.</p>
          <div className="mt-4 flex items-center rounded-xl bg-gray-50 dark:bg-white/5">
            <input
              type="email"
              placeholder="E-posta adresiniz"
              className="w-full rounded-l-xl bg-transparent px-4 py-3 text-sm text-[#132843] outline-none placeholder:text-gray-400 dark:text-[#e7edf4] dark:placeholder:text-[#e7edf4]/30"
            />
            <button
              type="button"
              className="shrink-0 rounded-r-xl bg-[#d8ad43] px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#132843] transition-colors hover:bg-[#c79828]"
            >
              ABONE OL
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
