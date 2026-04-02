'use client'
import { useState } from 'react'

interface Props {
  url?: string
  className?: string
}

export default function ShareButton({ url, className = '' }: Props) {
  const [copied, setCopied] = useState(false)

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    const target = url ?? (typeof window !== 'undefined' ? window.location.href : '')
    navigator.clipboard.writeText(target).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`text-[10px] text-gray-400 hover:text-gray-600 dark:text-[#e7edf4]/40 dark:hover:text-[#e7edf4]/70 px-1.5 py-1 rounded transition-colors ${className}`}
      >
        {copied ? 'Kopyalandı ✓' : 'Paylaş'}
      </button>

      {copied && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right:  '1.5rem',
            zIndex: 50,
          }}
          className="px-4 py-2.5 bg-green-600 text-white text-xs font-medium rounded-lg shadow-campus-md animate-scale-in"
        >
          Bağlantı kopyalandı!
        </div>
      )}
    </>
  )
}
