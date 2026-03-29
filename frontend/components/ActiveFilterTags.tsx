'use client'

import { FilterState } from '@/types'
import { FOCUS_AREA_LABELS, PLATFORM_LABELS } from '@/lib/helpers'

interface Props {
  filters: FilterState
  onRemove: (key: keyof FilterState, value: string) => void
  onClearAll: () => void
}

function Pill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(216,173,67,0.14)] text-[#8f670b] border border-[rgba(216,173,67,0.18)] px-2.5 py-1 text-[10px] font-semibold dark:text-[#f0cf7a] dark:bg-[rgba(216,173,67,0.12)]">
      {label}
      <button onClick={onRemove} className="leading-none hover:opacity-70">
        x
      </button>
    </span>
  )
}

export default function ActiveFilterTags({ filters, onRemove, onClearAll }: Props) {
  const hasAny =
    filters.em_focus_area.length > 0 ||
    filters.source_platform.length > 0 ||
    filters.is_talent_program

  if (!hasAny) return null

  return (
    <div className="campus-card mx-3 mt-3 flex flex-wrap items-center gap-1.5 rounded-2xl px-4 py-3">
      <span className="campus-heading text-[11px] text-[#8f670b] dark:text-[#f0cf7a]">Aktif Filtreler</span>

      {filters.em_focus_area.map((v) => (
        <Pill key={v} label={FOCUS_AREA_LABELS[v] ?? v} onRemove={() => onRemove('em_focus_area', v)} />
      ))}
      {filters.source_platform.map((v) => (
        <Pill key={v} label={PLATFORM_LABELS[v]} onRemove={() => onRemove('source_platform', v)} />
      ))}
      {filters.is_talent_program && (
        <span className="campus-pill-gold inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold">
          Yetenek Programlari
          <button onClick={() => onRemove('is_talent_program', '')} className="hover:opacity-70">
            x
          </button>
        </span>
      )}

      <button onClick={onClearAll} className="ml-1 text-[10px] text-[#8f670b] hover:underline dark:text-[#f0cf7a]">
        Tumunu temizle
      </button>
    </div>
  )
}
