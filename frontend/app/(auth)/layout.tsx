'use client'

import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Left Side — Hero Visual */}
      <section className="relative w-full md:w-1/2 lg:w-3/5 min-h-[420px] md:min-h-screen flex items-end p-8 md:p-16 overflow-hidden">
        {/* Background Image + Gradient Overlay */}
        <div className="absolute inset-0 z-0 bg-[#051c38]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Cerrahpaşa Kampüs"
            className="h-full w-full object-cover"
            src="/campus-hero.jpg"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#051c38]/90 to-[#051c38]/40" />
        </div>

        {/* Institutional Header Overlay */}
        <div className="absolute top-0 left-0 p-6 md:p-8 z-20 flex items-center gap-4">
          <Link href="/listings">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Üniversite logosu"
              className="h-16 w-16 md:h-20 md:w-20 object-contain"
              src="/campus-logo-white.png"
            />
          </Link>
          <div>
            <h2 className="campus-heading text-white text-base md:text-lg leading-tight">
              İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA
            </h2>
            <p className="text-[#f0c056] text-[10px] md:text-xs font-semibold tracking-[0.15em] uppercase">
              Endüstri Mühendisliği Staj Platformu
            </p>
          </div>
        </div>

        {/* Main Title */}
        <div className="relative z-10 max-w-xl">
          <h1 className="campus-heading text-white text-3xl md:text-5xl lg:text-6xl leading-[1.1] mb-6">
            Endüstri Mühendisliği Staj ve Yetenek Platformu
          </h1>
          <p className="text-[#d5e3ff] text-lg md:text-2xl font-light tracking-wide border-l-2 border-[#d8ad43] pl-6">
            Geleceğinize Açılan Kapı
          </p>
        </div>
      </section>

      {/* Right Side — Form Area */}
      <section className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-6 md:p-12 bg-white dark:bg-[#0b1a2c]">
        <div className="w-full max-w-md">
          {children}
        </div>
      </section>
    </div>
  )
}
