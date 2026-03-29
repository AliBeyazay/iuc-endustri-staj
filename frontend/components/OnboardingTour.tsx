'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TourStep {
  /** data-tour attribute value on the target element */
  target: string
  title: string
  body: string
  /** preferred placement */
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

interface TooltipPos {
  top: number
  left: number
  arrowSide: 'top' | 'bottom' | 'left' | 'right'
}

const STORAGE_KEY = 'iuc_onboarding_done'
const TOOLTIP_GAP = 12

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnboardingTour({ steps, tourId }: { steps: TourStep[]; tourId: string }) {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState<TooltipPos | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  // Check if tour was already completed
  useEffect(() => {
    try {
      const done = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (!done[tourId]) {
        // Small delay so page has time to render
        const timer = setTimeout(() => setActive(true), 1200)
        return () => clearTimeout(timer)
      }
    } catch {
      // corrupt data – show tour
      const timer = setTimeout(() => setActive(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [tourId])

  const finish = useCallback(() => {
    setActive(false)
    try {
      const done = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      done[tourId] = true
      localStorage.setItem(STORAGE_KEY, JSON.stringify(done))
    } catch { /* ignore */ }
    // Clean up highlight
    document.querySelectorAll('[data-tour-highlight]').forEach((el) => {
      el.removeAttribute('data-tour-highlight')
    })
  }, [tourId])

  const positionTooltip = useCallback(() => {
    if (!active || step >= steps.length) return
    const current = steps[step]
    const el = document.querySelector(`[data-tour="${current.target}"]`) as HTMLElement | null
    if (!el) {
      // Target not found – skip step
      if (step < steps.length - 1) setStep((s) => s + 1)
      else finish()
      return
    }

    // Highlight
    document.querySelectorAll('[data-tour-highlight]').forEach((h) => {
      h.removeAttribute('data-tour-highlight')
    })
    el.setAttribute('data-tour-highlight', 'true')

    // Scroll into view if needed
    const rect = el.getBoundingClientRect()
    if (rect.top < 80 || rect.bottom > window.innerHeight - 40) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    // Wait a frame so scroll settles
    rafRef.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      const tt = tooltipRef.current
      const tw = tt?.offsetWidth || 300
      const th = tt?.offsetHeight || 140

      const preferred = current.placement || 'bottom'
      let finalPos: TooltipPos

      const spaceBelow = window.innerHeight - r.bottom
      const spaceAbove = r.top
      const spaceRight = window.innerWidth - r.right
      const spaceLeft = r.left

      if (preferred === 'bottom' && spaceBelow >= th + TOOLTIP_GAP) {
        finalPos = {
          top: r.bottom + TOOLTIP_GAP + window.scrollY,
          left: Math.max(12, Math.min(r.left + r.width / 2 - tw / 2 + window.scrollX, window.innerWidth - tw - 12)),
          arrowSide: 'top',
        }
      } else if (preferred === 'top' && spaceAbove >= th + TOOLTIP_GAP) {
        finalPos = {
          top: r.top - th - TOOLTIP_GAP + window.scrollY,
          left: Math.max(12, Math.min(r.left + r.width / 2 - tw / 2 + window.scrollX, window.innerWidth - tw - 12)),
          arrowSide: 'bottom',
        }
      } else if (preferred === 'right' && spaceRight >= tw + TOOLTIP_GAP) {
        finalPos = {
          top: Math.max(12, r.top + r.height / 2 - th / 2 + window.scrollY),
          left: r.right + TOOLTIP_GAP + window.scrollX,
          arrowSide: 'left',
        }
      } else if (preferred === 'left' && spaceLeft >= tw + TOOLTIP_GAP) {
        finalPos = {
          top: Math.max(12, r.top + r.height / 2 - th / 2 + window.scrollY),
          left: r.left - tw - TOOLTIP_GAP + window.scrollX,
          arrowSide: 'right',
        }
      } else if (spaceBelow >= th + TOOLTIP_GAP) {
        finalPos = {
          top: r.bottom + TOOLTIP_GAP + window.scrollY,
          left: Math.max(12, Math.min(r.left + r.width / 2 - tw / 2 + window.scrollX, window.innerWidth - tw - 12)),
          arrowSide: 'top',
        }
      } else {
        finalPos = {
          top: r.top - th - TOOLTIP_GAP + window.scrollY,
          left: Math.max(12, Math.min(r.left + r.width / 2 - tw / 2 + window.scrollX, window.innerWidth - tw - 12)),
          arrowSide: 'bottom',
        }
      }

      setPos(finalPos)
    })
  }, [active, step, steps, finish])

  // Position on step change etc.
  useEffect(() => {
    positionTooltip()
    return () => cancelAnimationFrame(rafRef.current)
  }, [positionTooltip])

  // Reposition on resize/scroll
  useEffect(() => {
    if (!active) return
    const handler = () => positionTooltip()
    window.addEventListener('resize', handler)
    window.addEventListener('scroll', handler, true)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('scroll', handler, true)
    }
  }, [active, positionTooltip])

  if (!active || step >= steps.length) return null

  const isFirst = step === 0
  const isLast = step === steps.length - 1

  const tooltip = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40 transition-opacity"
        onClick={finish}
      />
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
        className="absolute z-[10000] w-[300px] rounded-2xl border border-[#d8ad43]/25 bg-white p-4 shadow-[0_20px_50px_rgba(18,40,67,0.22)] dark:bg-[#0e1e33] dark:border-[#d8ad43]/35"
      >
        {/* Arrow */}
        {pos && (
          <span
            className="absolute h-3 w-3 rotate-45 border border-[#d8ad43]/25 bg-white dark:bg-[#0e1e33] dark:border-[#d8ad43]/35"
            style={{
              ...(pos.arrowSide === 'top' && { top: -7, left: '50%', marginLeft: -6, borderBottom: 'none', borderRight: 'none' }),
              ...(pos.arrowSide === 'bottom' && { bottom: -7, left: '50%', marginLeft: -6, borderTop: 'none', borderLeft: 'none' }),
              ...(pos.arrowSide === 'left' && { left: -7, top: '50%', marginTop: -6, borderRight: 'none', borderTop: 'none' }),
              ...(pos.arrowSide === 'right' && { right: -7, top: '50%', marginTop: -6, borderLeft: 'none', borderBottom: 'none' }),
            }}
          />
        )}

        {/* Close button */}
        <button
          onClick={finish}
          className="absolute right-2 top-2 rounded-full p-1 text-[#173156]/50 hover:text-[#173156] dark:text-[#e7edf4]/50 dark:hover:text-[#e7edf4]"
          aria-label="Turu kapat"
        >
          <X size={14} />
        </button>

        {/* Step counter */}
        <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#8f670b]/60 dark:text-[#f0cf7a]/60">
          {step + 1} / {steps.length}
        </p>

        <h3 className="text-sm font-bold text-[#132843] dark:text-[#e7edf4]">
          {steps[step].title}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-[#173156]/72 dark:text-[#e7edf4]/60">
          {steps[step].body}
        </p>

        {/* Nav */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={finish}
            className="text-xs font-medium text-[#173156]/50 hover:text-[#173156] dark:text-[#e7edf4]/50 dark:hover:text-[#e7edf4]"
          >
            Atla
          </button>
          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-[#d8ad43]/20 bg-white px-3 py-1.5 text-xs font-medium text-[#132843] dark:bg-white/8 dark:text-[#e7edf4] dark:border-[#d8ad43]/30"
              >
                <ChevronLeft size={12} /> Geri
              </button>
            )}
            {isLast ? (
              <button
                onClick={finish}
                className="inline-flex items-center gap-1 rounded-xl bg-[#132843] px-3 py-1.5 text-xs font-semibold text-white dark:bg-[#d8ad43] dark:text-[#0a1628]"
              >
                Tamam ✓
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-1 rounded-xl bg-[#132843] px-3 py-1.5 text-xs font-semibold text-white dark:bg-[#d8ad43] dark:text-[#0a1628]"
              >
                İleri <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(tooltip, document.body)
}
