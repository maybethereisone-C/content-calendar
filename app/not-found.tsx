/**
 * app/not-found.tsx — Global 404 page (UI-SPEC §8, ACCESS-04)
 *
 * Rendered by Next.js when:
 *   - No route matches the path (e.g. /random)
 *   - A page calls notFound()
 *
 * NOT what middleware returns for invalid tokens — middleware returns
 * new NextResponse(null, { status: 404 }) with an empty body to satisfy
 * ACCESS-04 byte-identical-response requirement. This page is for the
 * user-visible 404 case (browser navigation to an unknown route).
 *
 * Design contract (UI-SPEC §8):
 *   - No app bar (no LanguageToggle / ThemeToggle — token-less context)
 *   - No CTA link back to /c/... (would reveal routing structure)
 *   - Full-screen centered layout; ShieldOff icon; English-only static copy
 *   - CSS variables from globals.css for theme-adaptive colors (light/dark)
 *
 * Note: bilingual via getTranslations — defaults to English when lang
 * cookie is absent (i18n/request.ts fallback = 'en').
 */
import { getTranslations } from 'next-intl/server'
import { ShieldOff } from 'lucide-react'

export default async function NotFound() {
  const t = await getTranslations('notFound')

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-4 px-10 text-center"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      {/* Icon container — rounded square on surface-2 */}
      <div
        className="flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'var(--surface-2)',
          color: 'var(--text-mut)',
        }}
      >
        <ShieldOff size={28} aria-hidden />
      </div>

      {/* Heading */}
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>
        {t('heading')}
      </h1>

      {/* Body copy */}
      <p
        style={{
          fontSize: 16,
          color: 'var(--text-mut)',
          maxWidth: 240,
          lineHeight: 1.5,
        }}
      >
        {t('body')}
      </p>
    </main>
  )
}
