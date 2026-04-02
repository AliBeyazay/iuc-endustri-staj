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
    <div className="campus-shell min-h-screen">
      <nav className="campus-nav sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <Link href="/listings" className="relative z-10 flex min-w-0 items-center gap-3">
          <UniversityLogo className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" />
          <div className="min-w-0">
            <span className="campus-brand block text-[11px] leading-tight xs:text-xs sm:text-2xl sm:leading-none whitespace-nowrap">
              İstanbul Üniversitesi-Cerrahpaşa
            </span>
            <p className="text-[7px] uppercase tracking-[0.12em] text-[#f4e3b3]/80 xs:text-[8px] sm:text-[10px] sm:tracking-[0.28em] whitespace-nowrap">
              Endüstri Mühendisliği Staj Platformu
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
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
      </div>
    </div>
  )
}
