'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import {
  bulkDeleteAdminListings,
  deleteAdminListing,
  fetchAdminListings,
  fetchUserProfile,
  moderateAdminListing,
} from '@/lib/api'
import { AdminListingItem, ModerationStatus, UserProfile } from '@/types'
import ThemeToggle from '@/components/ThemeToggle'

type EditFormState = {
  id: string
  title: string
  company_name: string
  location: string
  moderation_status: ModerationStatus
  moderation_note: string
  is_active: boolean
}

const STATUS_LABELS: Record<ModerationStatus, string> = {
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  pending: 'Beklemede',
}

export default function AdminModerationPage() {
  const router = useRouter()
  const { status } = useSession()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ModerationStatus | ''>('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editing, setEditing] = useState<EditFormState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [router, status])

  const { data: profile } = useSWR<UserProfile>(
    status === 'authenticated' ? 'profile' : null,
    fetchUserProfile,
  )

  const adminQueryKey = status === 'authenticated'
    ? ['admin-listings', search, statusFilter].join(':')
    : null
  const { data, isLoading, error, mutate } = useSWR(
    adminQueryKey,
    () => fetchAdminListings({ search, moderation_status: statusFilter, limit: 300 }),
  )

  const rows: AdminListingItem[] = data?.results ?? []
  const isAllSelected = rows.length > 0 && selectedIds.length === rows.length

  const selectedCountLabel = useMemo(() => {
    if (selectedIds.length === 0) return 'Seçim yok'
    return `${selectedIds.length} ilan seçildi`
  }, [selectedIds.length])

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Yükleniyor...</div>
  }
  if (status === 'unauthenticated') return null

  if (profile && !profile.is_staff) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Bu sayfaya erişim için admin yetkisi gerekiyor.
        </div>
      </div>
    )
  }

  async function handleApprove(id: string) {
    await moderateAdminListing(id, { action: 'approve' })
    await mutate()
  }

  async function handleReject(id: string) {
    await moderateAdminListing(id, { action: 'reject' })
    await mutate()
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu ilan kalıcı olarak silinecek. Devam edilsin mi?')) return
    await deleteAdminListing(id)
    setSelectedIds((prev) => prev.filter((x) => x !== id))
    await mutate()
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return
    if (!confirm(`${selectedIds.length} ilan kalıcı olarak silinecek. Devam edilsin mi?`)) return
    await bulkDeleteAdminListings(selectedIds)
    setSelectedIds([])
    await mutate()
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      await moderateAdminListing(editing.id, {
        title: editing.title,
        company_name: editing.company_name,
        location: editing.location,
        moderation_status: editing.moderation_status,
        moderation_note: editing.moderation_note,
        is_active: editing.is_active,
      })
      setEditing(null)
      await mutate()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] px-4 py-6 text-[#132843] dark:bg-[#0f1f34] dark:text-[#e7edf4] sm:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Admin Dashboard - İlan Moderasyonu</h1>
            <p className="text-sm text-[#173156]/70 dark:text-[#e7edf4]/65">Onay, red, düzenleme ve toplu silme</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => mutate()}
              className="rounded-lg border border-[#1E3A5F]/25 px-3 py-2 text-xs font-medium hover:bg-[#1E3A5F]/5"
            >
              Yenile
            </button>
            <Link href="/dashboard" className="rounded-lg border border-[#1E3A5F]/25 px-3 py-2 text-xs font-medium hover:bg-[#1E3A5F]/5">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
          <div className="grid gap-2 md:grid-cols-[1fr_200px_auto_auto] md:items-center">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Başlık, şirket, konum ara..."
              className="h-10 rounded-lg border border-[#1E3A5F]/20 px-3 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ModerationStatus | '')}
              className="h-10 rounded-lg border border-[#1E3A5F]/20 px-3 text-sm"
            >
              <option value="">Tüm Durumlar</option>
              <option value="approved">Onaylandı</option>
              <option value="pending">Beklemede</option>
              <option value="rejected">Reddedildi</option>
            </select>
            <p className="text-xs text-[#173156]/70 dark:text-[#e7edf4]/65">{selectedCountLabel}</p>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedIds.length === 0}
              className="h-10 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-600 disabled:opacity-50"
            >
              Toplu Sil
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
          {isLoading ? <p className="text-sm">İlanlar yükleniyor...</p> : null}
          {error ? <p className="text-sm text-red-600">İlanlar alınamadı.</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#d8ad43]/20 text-xs uppercase tracking-wide text-[#173156]/65 dark:text-[#e7edf4]/60">
                  <th className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(event) =>
                        setSelectedIds(event.target.checked ? rows.map((row) => row.id) : [])
                      }
                    />
                  </th>
                  <th className="px-2 py-2">Başlık</th>
                  <th className="px-2 py-2">Şirket</th>
                  <th className="px-2 py-2">Platform</th>
                  <th className="px-2 py-2">Durum</th>
                  <th className="px-2 py-2">Aktif</th>
                  <th className="px-2 py-2">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[#d8ad43]/10 align-top">
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={(event) =>
                          setSelectedIds((prev) =>
                            event.target.checked ? [...prev, row.id] : prev.filter((x) => x !== row.id)
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-3">{row.title}</td>
                    <td className="px-2 py-3">{row.company_name}</td>
                    <td className="px-2 py-3">{row.source_platform}</td>
                    <td className="px-2 py-3">{STATUS_LABELS[row.moderation_status]}</td>
                    <td className="px-2 py-3">{row.is_active ? 'Evet' : 'Hayır'}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => handleApprove(row.id)}
                          className="rounded border border-emerald-300 px-2 py-1 text-[11px] text-emerald-700"
                        >
                          Onayla
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(row.id)}
                          className="rounded border border-amber-300 px-2 py-1 text-[11px] text-amber-700"
                        >
                          Reddet
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({
                              id: row.id,
                              title: row.title,
                              company_name: row.company_name,
                              location: row.location,
                              moderation_status: row.moderation_status,
                              moderation_note: row.moderation_note ?? '',
                              is_active: row.is_active,
                            })
                          }
                          className="rounded border border-[#1E3A5F]/30 px-2 py-1 text-[11px]"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          className="rounded border border-red-300 px-2 py-1 text-[11px] text-red-600"
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-4 text-sm text-[#173156]/65 dark:text-[#e7edf4]/60">
                      Filtreye uygun ilan bulunamadı.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {editing ? (
          <div className="rounded-2xl border border-[#d8ad43]/20 bg-white p-4 dark:bg-white/5">
            <h2 className="text-sm font-semibold">İlan Düzenle</h2>
            <form onSubmit={handleSaveEdit} className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={editing.title}
                onChange={(event) => setEditing((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                className="h-10 rounded-lg border border-[#1E3A5F]/20 px-3 text-sm"
                placeholder="Başlık"
              />
              <input
                value={editing.company_name}
                onChange={(event) => setEditing((prev) => (prev ? { ...prev, company_name: event.target.value } : prev))}
                className="h-10 rounded-lg border border-[#1E3A5F]/20 px-3 text-sm"
                placeholder="Şirket"
              />
              <input
                value={editing.location}
                onChange={(event) => setEditing((prev) => (prev ? { ...prev, location: event.target.value } : prev))}
                className="h-10 rounded-lg border border-[#1E3A5F]/20 px-3 text-sm"
                placeholder="Konum"
              />
              <select
                value={editing.moderation_status}
                onChange={(event) => setEditing((prev) => (prev ? { ...prev, moderation_status: event.target.value as ModerationStatus } : prev))}
                className="h-10 rounded-lg border border-[#1E3A5F]/20 px-3 text-sm"
              >
                <option value="approved">Onaylandı</option>
                <option value="pending">Beklemede</option>
                <option value="rejected">Reddedildi</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(event) => setEditing((prev) => (prev ? { ...prev, is_active: event.target.checked } : prev))}
                />
                Aktif ilan
              </label>
              <textarea
                value={editing.moderation_note}
                onChange={(event) => setEditing((prev) => (prev ? { ...prev, moderation_note: event.target.value } : prev))}
                className="min-h-[84px] rounded-lg border border-[#1E3A5F]/20 px-3 py-2 text-sm md:col-span-2"
                placeholder="Moderasyon notu"
              />
              <div className="flex gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="h-10 rounded-lg border border-gray-300 px-3 text-xs font-semibold"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-lg bg-[#1E3A5F] px-3 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  )
}
