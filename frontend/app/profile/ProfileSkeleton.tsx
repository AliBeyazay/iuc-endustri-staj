import AuthedNavbar from '@/components/AuthedNavbar'

export default function ProfileSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f9f9ff] dark:bg-[#0e1e33]">
      <AuthedNavbar activePath="/profile" />

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#1a2d45]">
          <div className="mb-6 flex items-center justify-between">
            <div className="h-7 w-32 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />
          </div>

          <div className="flex items-start gap-4">
            <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-48 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
              <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
            </div>
          </div>

          <hr className="my-6 border-gray-100 dark:border-white/5" />

          <div className="grid gap-6 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                <div className="h-5 w-full animate-pulse rounded bg-gray-200 dark:bg-white/10" />
              </div>
            ))}
          </div>

          <hr className="my-6 border-gray-100 dark:border-white/5" />

          <div className="space-y-4">
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  )
}
