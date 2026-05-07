/**
 * app/layout.tsx — Root layout (Server Component)
 *
 * FOUC prevention (D-30 / THEME-03): The inline <script> is the FIRST
 * child of <head>. It reads localStorage.theme synchronously before any
 * CSS paints, setting data-theme on <html>. This prevents a flash of
 * the wrong theme on reload.
 *
 * i18n (D-19): getLocale() reads the `lang` cookie via i18n/request.ts.
 * Falls back to 'en'. NextIntlClientProvider makes messages available
 * to all Client Components.
 *
 * This component MUST remain a Server Component — it calls getLocale()
 * and getMessages() from next-intl/server. Do NOT add 'use client'.
 */
import './globals.css'
import { Inter, Noto_Sans_Thai } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-sans',
  display: 'swap',
})

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai'],
  weight: ['400', '600'],
  variable: '--font-thai',
  display: 'swap',
})

export const metadata = {
  title: 'Content Calendar',
  description: 'ระบบอนุมัติโพสต์โซเชียลมีเดีย',
}

export const viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    // data-theme is intentionally omitted from SSR HTML — the inline FOUC
    // script sets it before paint based on localStorage.theme.
    // data-lang mirrors locale for CSS-attribute-driven font selection.
    <html lang={locale} data-lang={locale}>
      <head>
        {/* THEME-03 / D-30 / FOUC prevention: MUST be the FIRST child of <head>.
            Sets data-theme synchronously from localStorage before any CSS paints.
            IIFE + try/catch handles SSR + storage-blocked browsers safely.
            The __html payload is a static string — no user input flows into it (T-02-08). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark')}else{document.documentElement.setAttribute('data-theme','light')}}catch(e){}})();",
          }}
        />
      </head>
      <body className={`${inter.variable} ${notoSansThai.variable}`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
