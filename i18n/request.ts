/**
 * i18n/request.ts — next-intl server request config (without-routing pattern)
 *
 * Reads locale from the `lang` cookie. Falls back to 'en' if absent or invalid.
 * Per D-19 (CONTEXT): locale lives in cookie, not URL prefix.
 * Per D-20: default is English regardless of navigator.language.
 *
 * Locale precedence: cookie.lang → fallback 'en'
 */
import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

const VALID_LOCALES = ['en', 'th'] as const
type Locale = (typeof VALID_LOCALES)[number]

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get('lang')?.value

  const locale: Locale =
    cookieValue && (VALID_LOCALES as readonly string[]).includes(cookieValue)
      ? (cookieValue as Locale)
      : 'en'

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
