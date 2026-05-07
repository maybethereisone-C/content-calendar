import { getTranslations, getLocale } from 'next-intl/server'
import { BrandMark } from './brand-mark'
import { LanguageToggle } from './language-toggle'
import { ThemeToggle } from './theme-toggle'

export async function AppBar() {
  const t = await getTranslations('app')
  const locale = await getLocale()

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        height: 56,
      }}
    >
      <div
        className="max-w-screen-sm mx-auto flex items-center justify-between px-4"
        style={{ height: 56 }}
      >
        <div className="flex items-center" style={{ gap: 8 }}>
          <BrandMark />
          <span
            className={locale === 'th' ? 'wordmark thai' : 'wordmark'}
            style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--text)',
              fontFamily:
                locale === 'th'
                  ? 'var(--font-thai), sans-serif'
                  : 'var(--font-sans), sans-serif',
            }}
          >
            {t('wordmark')}
          </span>
        </div>
        <div className="app-bar-actions flex items-center" style={{ gap: 4 }}>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
