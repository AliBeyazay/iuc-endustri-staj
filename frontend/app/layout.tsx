import type { Metadata } from 'next'
import { Oswald, Source_Sans_3 } from 'next/font/google'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import ThemeProvider from '@/components/ThemeProvider'
import SiteFooter from '@/components/SiteFooter'
import ScrollToTopButton from '@/components/ScrollToTopButton'

const headingFont = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-heading',
})

const bodyFont = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: '\u0130stanbul \u00dcniversitesi Cerrahpa\u015fa End\u00fcstri M\u00fchendisli\u011fi Staj Platformu',
  description:
    '\u0130stanbul \u00dcniversitesi Cerrahpa\u015fa End\u00fcstri M\u00fchendisli\u011fi Staj Platformu',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${headingFont.variable} ${bodyFont.variable} font-sans`}>
        <SessionProvider>
          <ThemeProvider>
            <div className="min-h-screen flex flex-col">
              <main className="flex-1">{children}</main>
              <SiteFooter />
              <ScrollToTopButton />
            </div>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
