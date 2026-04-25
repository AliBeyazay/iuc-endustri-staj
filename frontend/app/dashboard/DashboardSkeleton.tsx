import AuthedNavbar from '@/components/AuthedNavbar'

export default function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f9f9ff] dark:bg-[#0e1e33]">
      {/* ── Navbar Placeholder ── */}
      <AuthedNavbar activePath="/dashboard" />

      {/* ── Main Content Skeleton ── */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        
        {/* Welcome Skeleton */}
        <div className="mb-8">
          <div className="h-8 w-64 animate-pulse rounded-md bg-gray-200 dark:bg-white/10" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded-md bg-gray-200 dark:bg-white/10" />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#1a2d45]">
              <div className="h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
            </div>
          ))}
        </div>

        {/* Applications Board Skeleton */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
            <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-gray-200 border-t-[3px] border-t-gray-300 bg-white p-3 dark:border-white/10 dark:bg-[#1a2d45]">
                <div className="mb-3 flex items-center justify-between">
                  <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                  <div className="h-4 w-6 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
                </div>
                <div className="space-y-2">
                  {[1, 2].map((j) => (
                    <div key={j} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 dark:border-white/8 dark:bg-white/5">
                      <div className="h-3 w-full animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                      <div className="mt-2 h-2 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                      <div className="mt-3 h-7 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bookmarks Skeleton */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="h-6 w-40 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-[#1a2d45]">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                  <div className="mt-2 h-3 w-1/4 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
