'use client'

import { useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { FilterState, SourcePlatform } from '@/types'
import { FOCUS_AREA_LIST, PLATFORM_LABELS } from '@/lib/helpers'

interface Props {
  filters: FilterState
  onFiltersChange: (next: Partial<FilterState>) => void
  listingCounts?: Record<string, number>
  isOpen?: boolean
}

function Section({
  title, defaultOpen = true, children,
}: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen(!open)}
        className="campus-heading mb-2 flex w-full items-center justify-between border-l-2 border-[#d8ad43]/40 pl-2.5 text-[11px] text-[#8f670b] transition-colors hover:text-[#6d4f06] dark:text-[#f0cf7a] dark:hover:text-[#f8e0a0]"
      >
        {title}
        <span className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <ChevronDown size={12} />
        </span>
      </button>
      <div className={`space-y-1.5 overflow-hidden transition-all duration-200 ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>{children}</div>
    </div>
  )
}

function CheckItem({
  label, checked, count, onChange,
}: { label: string; checked: boolean; count?: number; onChange: () => void }) {
  return (
    <label className="group flex cursor-pointer items-center gap-2 rounded-2xl border border-transparent bg-white/35 px-2.5 py-2 transition-all duration-150 hover:border-[#d8ad43]/20 hover:bg-white/70 dark:bg-white/5 dark:hover:bg-white/10">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded accent-[#d8ad43] transition-all"
      />
      <span className="flex-1 text-[11px] leading-tight text-[#173156]/74 group-hover:text-[#132843] dark:text-[#e7edf4]/65 dark:group-hover:text-[#e7edf4]">
        {label}
      </span>
      {count !== undefined && (
        <span className="rounded-full bg-[#d8ad43]/10 px-2 py-0.5 text-[10px] font-medium text-[#8f670b] dark:bg-[#d8ad43]/12 dark:text-[#f0cf7a]/80">
          {count}
        </span>
      )}
    </label>
  )
}

export default function FilterSidebar({
  filters,
  onFiltersChange,
  listingCounts = {},
  isOpen = false,
}: Props) {
  function toggleArray<T extends string>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
  }

  const hasAnyFilter =
    filters.em_focus_area.length > 0 ||
    filters.source_platform.length > 0 ||
    filters.is_talent_program

  return (
    <aside
      className={[
        'mx-3 mt-3 lg:sticky lg:top-3 lg:mt-0 lg:h-[calc(100vh-118px)] lg:w-[280px] lg:min-w-[280px]',
        isOpen ? 'block' : 'hidden',
        'lg:block',
      ].join(' ')}
    >
      <div className="campus-card h-full overflow-y-auto rounded-[28px] px-4 py-4">
        <div className="mb-5 rounded-3xl bg-[#132843] px-4 py-4 text-[#eef3fa] shadow-[0_18px_40px_rgba(10,21,35,0.2)]">
          <p className="campus-heading text-[11px] text-[#f0cf7a]">Akilli Filtreler</p>
          <p className="mt-2 text-sm font-semibold">Daha hizli ele, daha iyi eslesme yakala.</p>
          <p className="mt-1 text-[11px] text-white/68">
            Kaynak ve alan kombinasyonlariyla listeyi hemen daralt.
          </p>
        </div>

        <Section title="Sektor / Odak Alani">
          {FOCUS_AREA_LIST.map(({ value, label }) => (
            <CheckItem
              key={value}
              label={label}
              checked={filters.em_focus_area.includes(value)}
              count={listingCounts[value]}
              onChange={() =>
                onFiltersChange({
                  em_focus_area: toggleArray(filters.em_focus_area, value),
                  page: 1,
                })
              }
            />
          ))}

          <label
            className={`mt-2 flex items-start gap-2 rounded-3xl border px-3 py-3 transition-colors ${
              filters.is_talent_program
                ? 'border-[#d8ad43]/35 bg-[#f7ecd0] dark:bg-[#d8ad43]/15'
                : 'border-[#173156]/10 bg-white/55 hover:border-[#d8ad43]/30 hover:bg-[#fbf3de] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
            }`}
          >
            <input
              type="checkbox"
              checked={!!filters.is_talent_program}
              onChange={(e) =>
                onFiltersChange({ is_talent_program: e.target.checked || undefined, page: 1 })
              }
              className="mt-0.5 h-3.5 w-3.5 accent-[#b6891d]"
            />
            <div className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-[11px] font-semibold leading-tight text-[#8f670b] dark:text-[#f0cf7a]">
                <Sparkles size={12} />
                Yetenek Programlari
              </span>
              <span className="mt-1 block text-[10px] text-[#173156]/55 dark:text-[#e7edf4]/45">
                Yapilandirilmis staj ve uzun soluklu kariyer akisları
              </span>
            </div>
            <span className="shrink-0 text-[10px] text-[#8f670b]/60">
              {listingCounts.talent_program ?? ''}
            </span>
          </label>
        </Section>

        <hr className="my-4 border-[#d8ad43]/16" />

        <Section title="Platform" defaultOpen={false}>
          {(Object.entries(PLATFORM_LABELS) as [SourcePlatform, string][]).map(([val, lbl]) => (
            <CheckItem
              key={val}
              label={lbl}
              checked={filters.source_platform.includes(val)}
              count={listingCounts[val]}
              onChange={() =>
                onFiltersChange({
                  source_platform: toggleArray(filters.source_platform, val),
                  page: 1,
                })
              }
            />
          ))}
        </Section>

        {hasAnyFilter && (
          <button
            onClick={() =>
              onFiltersChange({
                em_focus_area: [],
                source_platform: [],
                is_talent_program: undefined,
                page: 1,
              })
            }
            className="campus-button-secondary mt-5 w-full rounded-full px-4 py-2 text-[11px] font-semibold"
          >
            Filtreleri Temizle
          </button>
        )}
      </div>
    </aside>
  )
}
