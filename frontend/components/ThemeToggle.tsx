'use client'

import { useTheme } from '@/components/ThemeProvider'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8ad43]/35 bg-white/10 text-[#f1d27e] transition-all duration-200 hover:-translate-y-px hover:bg-white/20 hover:ring-2 hover:ring-[#d8ad43]/20 active:scale-95"
    >
      {theme === 'dark' ? <Sun size={18} className="transition-transform duration-300" /> : <Moon size={18} className="transition-transform duration-300" />}
    </button>
  )
}
