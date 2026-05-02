import { Clock } from 'lucide-react'
import { daysUntilDeadline } from '@/lib/helpers'

interface Props {
  deadline: string
  size?: 'sm' | 'md'
}

/**
 * DeadlineCountdown — static "X gün kaldı" badge for urgent (≤7 day) deadlines.
 * No client-side JS needed; days are computed at render time.
 */
export default function DeadlineCountdown({ deadline, size = 'sm' }: Props) {
  const days = daysUntilDeadline(deadline)

  if (days === null || days < 0) return null

  const isToday   = days === 0
  const isCritical = days <= 2  // pulsing dot
  const label     = isToday ? 'Bugün son gün!' : `${days} gün kaldı`

  const colorClass = isCritical
    ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    : 'bg-[#f7ead2] text-[#a46c09] dark:bg-[#a46c09]/20 dark:text-[#f0cf7a]'

  const base = size === 'md'
    ? 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold'
    : 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold'

  return (
    <span className={`${base} ${colorClass}`}>
      {isCritical && (
        <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-red-500 opacity-75" />
      )}
      <Clock size={size === 'md' ? 14 : 11} className="shrink-0" />
      ⏰ {label}
    </span>
  )
}
