import useSWR from 'swr'
import useSWRInfinite from 'swr/infinite'
import { useCallback, useEffect, useState } from 'react'
import { FilterState, Listing, PaginatedResponse } from '@/types'
import { fetchListings, fetchReviews, fetchUserProfile } from '@/lib/api'
import { buildQueryString } from '@/lib/helpers'

// ─── useDebounce ─────────────────────────────────────────────────────────────

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── useListings (paginated, load-more style) ────────────────────────────────

export function useListings(filters: FilterState) {
  const getKey = useCallback(
    (pageIndex: number, prev: PaginatedResponse<Listing> | null) => {
      if (prev && !prev.next) return null
      const qs = buildQueryString({ ...filters, page: pageIndex + 1 })
      return `/listings/?${qs}`
    },
    [filters]
  )

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedResponse<Listing>>(
      getKey,
      (url) => fetchListings({ ...filters, page: Number(new URL('http://x' + url).searchParams.get('page') ?? 1) }),
      { revalidateFirstPage: false }
    )

  const listings: Listing[] = data ? data.flatMap((d) => d.results) : []
  const total = data?.[0]?.count ?? 0
  const hasMore = data ? !!data[data.length - 1]?.next : false

  return {
    listings,
    total,
    hasMore,
    isLoading,
    isValidating,
    loadMore: () => setSize(size + 1),
    mutate,
    error,
  }
}

// ─── useReviews ──────────────────────────────────────────────────────────────

export function useReviews(listingId: string) {
  const { data, error, mutate, isLoading } = useSWR(
    listingId ? `/reviews/?listing=${listingId}` : null,
    () => fetchReviews(listingId)
  )
  return { reviews: data ?? [], isLoading, error, mutate }
}

// ─── useProfile ──────────────────────────────────────────────────────────────

export function useProfile() {
  const { data, error, mutate, isLoading } = useSWR(
    '/profile/',
    fetchUserProfile
  )
  return { profile: data, isLoading, error, mutate }
}

// ─── useBookmarks (localStorage optimistic) ──────────────────────────────────

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('iuc_bookmarks')
      return new Set(stored ? JSON.parse(stored) : [])
    } catch {
      return new Set()
    }
  })

  const persist = (next: Set<string>) => {
    setBookmarks(next)
    localStorage.setItem('iuc_bookmarks', JSON.stringify([...next]))
  }

  const toggle = useCallback(
    async (id: string) => {
      const next = new Set(bookmarks)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      persist(next)

      try {
        const { addBookmark, removeBookmark } = await import('@/lib/api')
        if (next.has(id)) {
          await addBookmark(id)
        } else {
          await removeBookmark(id)
        }
      } catch {
        // rollback on error
        persist(bookmarks)
      }
    },
    [bookmarks]
  )

  return { bookmarks, toggle }
}

// ─── useMediaQuery ───────────────────────────────────────────────────────────

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return matches
}
