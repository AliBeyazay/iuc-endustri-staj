'use client'
import { useRef, useState } from 'react'

interface Props {
  onComplete: (otp: string) => void
  hasError: boolean
}

export default function OTPInput({ onComplete, hasError }: Props) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null))

  function handleChange(i: number, val: string) {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[i] = val
    setDigits(next)
    if (val && i < 5) refs[i + 1].current?.focus()
    if (next.every(Boolean)) onComplete(next.join(''))
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs[i - 1].current?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next  = [...text.split(''), ...Array(6).fill('')].slice(0, 6)
    setDigits(next)
    const focusIdx = Math.min(text.length, 5)
    refs[focusIdx].current?.focus()
    if (text.length === 6) onComplete(text)
  }

  return (
    <div className="flex gap-2 justify-center my-4">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          maxLength={1}
          inputMode="numeric"
          className={`
            w-11 h-13 text-center text-lg font-medium border rounded-lg
            focus:outline-none transition-all
            ${d
              ? 'border-[#1E3A5F] bg-blue-50 text-[#0C447C]'
              : 'border-gray-200 bg-gray-50 text-gray-800'
            }
            ${hasError ? 'border-red-400 bg-red-50 animate-shake' : ''}
          `}
        />
      ))}
    </div>
  )
}
