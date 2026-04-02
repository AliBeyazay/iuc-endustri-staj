export default function ListingCardSkeleton() {
  return (
    <div className="campus-card rounded-[26px] p-4">
      <div className="flex items-start gap-2 mb-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-[#173156]/8 campus-shimmer dark:bg-white/8" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-3/4 rounded-lg bg-[#173156]/8 campus-shimmer dark:bg-white/8" />
          <div className="h-2.5 w-1/2 rounded-lg bg-[#173156]/6 campus-shimmer dark:bg-white/6" />
        </div>
      </div>
      <div className="flex gap-1.5 mb-3">
        <div className="h-5 w-24 rounded-full bg-[#173156]/6 campus-shimmer dark:bg-white/6" />
        <div className="h-5 w-16 rounded-full bg-[#173156]/6 campus-shimmer dark:bg-white/6" />
        <div className="h-5 w-14 rounded-full bg-[#173156]/6 campus-shimmer dark:bg-white/6" />
      </div>
      <div className="mb-3 h-2.5 w-2/5 rounded-lg bg-[#173156]/6 campus-shimmer dark:bg-white/6" />
      <div className="flex justify-between border-t border-[#d8ad43]/12 pt-3">
        <div className="h-5 w-20 rounded-full bg-[#173156]/6 campus-shimmer dark:bg-white/6" />
        <div className="h-7 w-24 rounded-full bg-[#d8ad43]/12 campus-shimmer" />
      </div>
    </div>
  )
}
