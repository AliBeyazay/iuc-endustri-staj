'use client'

import Link from 'next/link'
import UniversityLogo from '@/components/UniversityLogo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-[28rem] xl:w-[32rem] flex-col justify-between campus-nav p-10 xl:p-12">
        <div>
          <Link href="/listings" className="flex items-center gap-4">
            <UniversityLogo className="h-16 w-16 shrink-0" />
            <div className="campus-brand text-3xl leading-none">
              {'\u0130stanbul \u00dcniversitesi Cerrahpa\u015fa'}
            </div>
          </Link>
          <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-[#f4e3b3]/78">
            {'End\u00fcstri M\u00fchendisli\u011fi Staj Platformu'}
          </p>
          <h1 className="mt-12 campus-heading text-6xl leading-[0.92] text-[#d8ad43] drop-shadow-[0_2px_12px_rgba(216,173,67,0.15)]">
            {'End\u00fcstri'}
            <br />
            {'M\u00fchendisli\u011fi'}
          </h1>
          <p className="mt-5 max-w-[14rem] text-sm leading-relaxed text-[#f7ecd0]/70">
            {'\u00d6\u011frenciler i\u00e7in staj ak\u0131\u015f\u0131, ger\u00e7ek ilanlar ve b\u00f6l\u00fcme uygun tek yerde toplanm\u0131\u015f deneyim.'}
          </p>
        </div>

        <div className="space-y-4">
          {[
            'G\u00fcncel ve \u00e7ok kaynakl\u0131 ilan havuzu',
            'B\u00f6l\u00fcme uygun filtreleme ve h\u0131zl\u0131 arama',
            'Kaynak sayfaya tek t\u0131kla ge\u00e7i\u015f',
          ].map((feat) => (
            <div key={feat} className="flex items-start gap-3 transition-transform duration-200 hover:translate-x-1">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#d8ad43]/35 bg-[#d8ad43]/14 text-[10px] text-[#f4e3b3] transition-colors duration-200 group-hover:bg-[#d8ad43]/25">
                +
              </div>
              <p className="text-sm text-[#f7ecd0]/72">{feat}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-[#f3efe5] text-[#132843] dark:bg-[#0b1a2c] dark:text-[#e7edf4]">
        {/* Mobile navbar - only visible on small screens */}
        <div className="lg:hidden campus-nav px-4 py-3 flex items-center gap-3">
          <Link href="/listings" className="flex items-center gap-3 min-w-0">
            <UniversityLogo className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
              <div className="campus-brand text-[11px] xs:text-xs sm:text-sm leading-tight text-white whitespace-nowrap">
                {'\u0130STANBUL \u00dcN\u0130VERS\u0130TES\u0130 CERRAHPA\u015eA'}
              </div>
              <div className="text-[9px] xs:text-[10px] uppercase tracking-[0.14em] xs:tracking-[0.18em] text-[#f4e3b3]/78 whitespace-nowrap">
                {'End\u00fcstri M\u00fchendisli\u011fi Staj Platformu'}
              </div>
            </div>
          </Link>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-60px)] lg:min-h-screen max-w-xl items-center justify-center p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
