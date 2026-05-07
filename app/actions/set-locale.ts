'use server'

/**
 * app/actions/set-locale.ts — Server Action: write the `lang` cookie
 *
 * Invoked by LanguageToggle (plan 04) when the user taps the language button.
 * Writes the `lang` cookie; client follows up with router.refresh() which
 * re-renders the page in the new locale (per D-22, D-29).
 *
 * Cookie attrs:
 *   Path=/         — applies to entire app
 *   Max-Age=1y     — survives browser restart
 *   SameSite=Lax   — protects against CSRF on cross-site GETs
 *   HttpOnly=false — client may also read for FOUC-free warm load
 *   Secure=true    — HTTPS-only in production
 *
 * T-02-01 mitigation: allow-list validation before any cookie write.
 */
import { cookies } from 'next/headers'

const VALID = new Set<string>(['en', 'th'])
const ONE_YEAR = 60 * 60 * 24 * 365

export async function setLocaleAction(locale: 'en' | 'th'): Promise<void> {
  if (!VALID.has(locale)) throw new Error('Invalid locale')

  const store = await cookies()
  store.set('lang', locale, {
    path: '/',
    maxAge: ONE_YEAR,
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  })
}
