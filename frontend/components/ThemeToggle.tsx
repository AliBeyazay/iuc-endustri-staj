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
      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8ad43]/35 bg-white/10 text-[#f1d27e] transition-colors hover:bg-white/20"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
