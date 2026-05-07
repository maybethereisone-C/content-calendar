'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Sun, Moon } from 'lucide-react'

type Theme = 'light' | 'dark'

export function ThemeToggle() {
  const t = useTranslations('app')
  // Initial state matches the FOUC script's default ('light').
  // useEffect on mount reads the actual stored value to keep state in sync
  // with the DOM attribute the FOUC script set before paint.
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme') as Theme | null
      if (stored === 'dark' || stored === 'light') setTheme(stored)
    } catch {}
  }, [])

  function onTap() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    try { localStorage.setItem('theme', next) } catch {}
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <button
      type="button"
      className="iconbtn theme-btn"
      onClick={onTap}
      aria-label={theme === 'light' ? t('switchToDark') : t('switchToLight')}
      style={{
        width: 36,
        height: 36,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'transparent',
        color: 'var(--text-mut)',
        cursor: 'pointer',
      }}
    >
      {theme === 'light' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  )
}
