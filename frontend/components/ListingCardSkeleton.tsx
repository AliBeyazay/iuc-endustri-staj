export default function ListingCardSkeleton() {
  return (
    <div className="campus-card animate-pulse rounded-2xl p-4">
      <div className="flex items-start gap-2 mb-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-[#173156]/8 dark:bg-white/8" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-3/4 rounded bg-[#173156]/8 dark:bg-white/8" />
          <div className="h-2.5 w-1/2 rounded bg-[#173156]/8 dark:bg-white/8" />
        </div>
      </div>
      <div className="flex gap-1 mb-2">
        <div className="h-4 w-24 rounded-full bg-[#173156]/8 dark:bg-white/8" />
        <div className="h-4 w-14 rounded-full bg-[#173156]/8 dark:bg-white/8" />
        <div className="h-4 w-14 rounded-full bg-[#173156]/8 dark:bg-white/8" />
      </div>
      <div className="mb-3 h-2.5 w-2/5 rounded bg-[#173156]/8 dark:bg-white/8" />
      <div className="flex justify-between border-t border-[#d8ad43]/12 pt-2">
        <div className="h-4 w-16 rounded-full bg-[#173156]/8 dark:bg-white/8" />
        <div className="h-6 w-20 rounded bg-[#d8ad43]/18" />
      </div>
    </div>
  )
}
