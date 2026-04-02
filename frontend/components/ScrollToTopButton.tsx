'use client'

import { useEffect, useState } from 'react'

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 260)

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      aria-label="Yukarı çık"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#d8ad43] shadow-[0_12px_30px_rgba(0,0,0,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-campus-md active:scale-95 animate-scale-in dark:border-[#d8ad43]/25 dark:bg-[#132843] dark:hover:bg-[#1a3558]"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 15l7-7 7 7" />
      </svg>
    </button>
  )
}
