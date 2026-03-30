'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { MessageCircle, Send } from 'lucide-react'
import { createInternshipJournal, createJournalComment, fetchInternshipJournals } from '@/lib/api'
import { InternshipJournal } from '@/types'
import { formatDateTurkish, getAvatarColor, getInitials, timeAgoTurkish } from '@/lib/helpers'
import ProfileDropdown from '@/components/ProfileDropdown'
import ThemeToggle from '@/components/ThemeToggle'
import UniversityLogo from '@/components/UniversityLogo'

export default function PaylasimlarPage() {
  const { status } = useSession()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [internshipYear, setInternshipYear] = useState(new Date().getFullYear())
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({})
  const [commentSubmittingFor, setCommentSubmittingFor] = useState<string | null>(null)
  const [commentAnonByJournal, setCommentAnonByJournal] = useState<Record<string, boolean>>({})
  const [commentError, setCommentError] = useState<Record<string, string>>({})

  const { data, isLoading, mutate } = useSWR<InternshipJournal[]>(
    'journals-global-feed',
    () => fetchInternshipJournals()
  )

  const journals = useMemo(() => data ?? [], [data])
  const isAuthenticated = status === 'authenticated'

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!isAuthenticated) {
      setError('Paylasim yapmak icin once giris yapmalisin.')
      return
    }
    if (title.trim().length < 8) {
      setError('Başlık en az 8 karakter olmalı.')
      return
    }
    if (content.trim().length < 120) {
      setError('Paylaşım metni en az 120 karakter olmalı.')
      return
    }

    try {
      setSubmitting(true)
      await createInternshipJournal({
        title: title.trim(),
        content: content.trim(),
        internship_year: internshipYear,
        is_anonymous: isAnonymous,
      })
      setTitle('')
      setContent('')
      setInternshipYear(new Date().getFullYear())
      setIsAnonymous(true)
      setSuccess('Paylasimin akisa eklendi.')
      await mutate()
    } catch (postError: any) {
      const message =
        postError?.response?.data?.detail ||
        postError?.response?.data?.non_field_errors?.[0] ||
        postError?.response?.data?.content?.[0] ||
        'Paylasim eklenemedi. Lutfen tekrar dene.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>, journalId: string) {
    event.preventDefault()
    setCommentError((prev) => ({ ...prev, [journalId]: '' }))
    const contentValue = (commentTexts[journalId] ?? '').trim()

    if (!isAuthenticated) {
      setCommentError((prev) => ({ ...prev, [journalId]: 'Yorum icin once giris yapmalisin.' }))
      return
    }
    if (contentValue.length < 2) {
      setCommentError((prev) => ({ ...prev, [journalId]: 'Yorum en az 2 karakter olmalı.' }))
      return
    }

    try {
      setCommentSubmittingFor(journalId)
      await createJournalComment({
        journal_id: journalId,
        content: contentValue,
        is_anonymous: commentAnonByJournal[journalId] ?? true,
      })
      setCommentTexts((prev) => ({ ...prev, [journalId]: '' }))
      await mutate()
    } catch (commentCreateError: any) {
      const message =
        commentCreateError?.response?.data?.detail ||
        commentCreateError?.response?.data?.content?.[0] ||
        'Yorum eklenemedi.'
      setCommentError((prev) => ({ ...prev, [journalId]: message }))
    } finally {
      setCommentSubmittingFor(null)
    }
  }

  return (
    <div className="campus-shell min-h-screen pb-20">
      <nav className="campus-nav sticky top-0 z-10 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/listings" className="flex min-w-0 items-center gap-3">
            <UniversityLogo className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" />
            <div className="min-w-0">
              <span className="campus-brand block text-[11px] leading-tight xs:text-xs sm:text-2xl sm:leading-none whitespace-nowrap">
                Istanbul Universitesi Cerrahpasa
              </span>
              <p className="text-[7px] uppercase tracking-[0.12em] text-[#f4e3b3]/80 xs:text-[8px] sm:text-[10px] sm:tracking-[0.28em] whitespace-nowrap">
                Endustri Muhendisligi Staj Platformu
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ProfileDropdown />
          </div>
        </div>
      </nav>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-3 py-4 sm:px-4 sm:py-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="campus-card rounded-[28px] p-5 sm:sticky sm:top-24 sm:h-fit">
          <h1 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8f670b] dark:text-[#f0cf7a]">
            Paylasimlar
          </h1>
          <p className="mt-2 text-sm text-[#173156]/70 dark:text-[#e7edf4]/60">
            Twitter benzeri akis: staj deneyimi yaz, yorum al, birbirinden ogren.
          </p>

          <form onSubmit={handleCreatePost} className="mt-4 space-y-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Baslik"
              maxLength={160}
              className="campus-input w-full rounded-2xl px-4 py-3 text-sm"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={7}
              placeholder="Staj deneyimini detayli paylas..."
              className="campus-input w-full rounded-2xl px-4 py-3 text-sm leading-7"
            />
            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
              <input
                type="number"
                value={internshipYear}
                onChange={(event) => setInternshipYear(Number(event.target.value))}
                min={2000}
                max={2100}
                className="campus-input w-full rounded-2xl px-4 py-3 text-sm"
              />
              <label className="flex items-center gap-2 text-xs text-[#173156]/75 dark:text-[#e7edf4]/65">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(event) => setIsAnonymous(event.target.checked)}
                  className="h-4 w-4 rounded border-[#d8ad43]/30"
                />
                Anonim
              </label>
            </div>

            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="campus-button-primary w-full rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Paylasiliyor...' : 'Paylas'}
            </button>
          </form>
        </aside>

        <section className="space-y-3">
          {isLoading ? (
            <div className="campus-card rounded-2xl p-4 text-sm text-[#173156]/70 dark:text-[#e7edf4]/60">
              Akis yukleniyor...
            </div>
          ) : journals.length === 0 ? (
            <div className="campus-card rounded-2xl p-5 text-sm text-[#173156]/70 dark:text-[#e7edf4]/60">
              Henüz paylaşım yok. İlk staj günlüğünü sen paylaşabilirsin.
            </div>
          ) : (
            journals.map((journal) => {
              const avatarColor = getAvatarColor(journal.student_display_name)
              const initials = getInitials(journal.student_display_name)
              const isCommentSubmitting = commentSubmittingFor === journal.id
              return (
                <article key={journal.id} className="campus-card rounded-2xl p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColor}`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-semibold text-[#132843] dark:text-[#e7edf4]">
                          {journal.student_display_name}
                        </p>
                        <span className="text-xs text-[#173156]/55 dark:text-[#e7edf4]/45">
                          {timeAgoTurkish(journal.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#173156]/58 dark:text-[#e7edf4]/48">
                        Staj yili: {journal.internship_year}
                        {journal.listing_title ? ` - İlan: ${journal.listing_title}` : ''}
                      </p>
                      <h2 className="mt-3 text-sm font-semibold text-[#132843] dark:text-[#e7edf4]">
                        {journal.title}
                      </h2>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#173156]/82 dark:text-[#e7edf4]/72">
                        {journal.content}
                      </p>

                      <div className="mt-4 flex items-center gap-2 text-xs text-[#173156]/58 dark:text-[#e7edf4]/48">
                        <MessageCircle size={14} />
                        {journal.comments_count} yorum
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-dashed border-[#d8ad43]/25 pt-4">
                    {journal.comments.length > 0 ? (
                      journal.comments.map((comment) => (
                        <div key={comment.id} className="rounded-xl border border-[#d8ad43]/16 bg-white/60 px-3 py-2 dark:bg-white/5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-[#132843] dark:text-[#e7edf4]">
                              {comment.student_display_name}
                            </p>
                            <span className="text-[10px] text-[#173156]/55 dark:text-[#e7edf4]/45">
                              {formatDateTurkish(comment.created_at)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-[#173156]/80 dark:text-[#e7edf4]/70">{comment.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#173156]/58 dark:text-[#e7edf4]/48">Henüz yorum yok.</p>
                    )}

                    <form onSubmit={(event) => handleCommentSubmit(event, journal.id)} className="rounded-xl border border-[#d8ad43]/16 bg-white/50 p-2 dark:bg-white/5">
                      <div className="flex gap-2">
                        <input
                          value={commentTexts[journal.id] ?? ''}
                          onChange={(event) =>
                            setCommentTexts((prev) => ({ ...prev, [journal.id]: event.target.value }))
                          }
                          placeholder="Yorum yaz..."
                          className="campus-input min-w-0 flex-1 rounded-xl px-3 py-2 text-sm"
                        />
                        <button
                          type="submit"
                          disabled={isCommentSubmitting}
                          className="campus-button-primary inline-flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-60"
                          aria-label="Yorumu gonder"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <label className="flex items-center gap-2 text-[11px] text-[#173156]/70 dark:text-[#e7edf4]/60">
                          <input
                            type="checkbox"
                            checked={commentAnonByJournal[journal.id] ?? true}
                            onChange={(event) =>
                              setCommentAnonByJournal((prev) => ({ ...prev, [journal.id]: event.target.checked }))
                            }
                            className="h-3.5 w-3.5 rounded border-[#d8ad43]/30"
                          />
                          Anonim yorum
                        </label>
                        {commentError[journal.id] ? (
                          <p className="text-[11px] text-red-600">{commentError[journal.id]}</p>
                        ) : null}
                      </div>
                    </form>
                  </div>
                </article>
              )
            })
          )}
        </section>
      </div>
    </div>
  )
}
