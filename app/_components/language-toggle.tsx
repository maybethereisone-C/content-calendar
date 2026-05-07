'use client'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Languages } from 'lucide-react'
import { setLocaleAction } from '@/app/actions/set-locale'

export function LanguageToggle() {
  const locale = useLocale() as 'en' | 'th'
  const t = useTranslations('app')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const next = locale === 'en' ? 'th' : 'en'

  async function onTap() {
    try { localStorage.setItem('lang', next) } catch {}
    await setLocaleAction(next)
    startTransition(() => router.refresh())
  }

  return (
    <button
      type="button"
      className="iconbtn lang"
      onClick={onTap}
      disabled={isPending}
      aria-label={locale === 'en' ? t('switchToThai') : t('switchToEnglish')}
      style={{
        height: 36,
        padding: '0 10px',
        display: 'inline-flex',
        gap: 4,
        alignItems: 'center',
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'transparent',
        color: 'var(--text-mut)',
        cursor: 'pointer',
        minWidth: 44, // iOS HIG touch target via padding
      }}
    >
      <Languages size={16} aria-hidden />
      <span style={{ fontSize: 12, fontWeight: 600 }}>{next.toUpperCase()}</span>
    </button>
  )
}
