'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { WifiOff } from 'lucide-react'

export function OfflineToast() {
  const t = useTranslations('offline')
  const [online, setOnline] = useState(true)

  useEffect(() => {
    // Initialize from current state on mount (after hydration to avoid mismatch)
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center"
      style={{
        position: 'fixed',
        top: 70,
        left: 16,
        right: 16,
        zIndex: 200,
        background: 'var(--warn)',
        color: 'var(--warn-fg)', // var(--warn-fg) — NEVER #fff (THEME-05 / REQ-25)
        borderRadius: 12,
        padding: '12px 14px',
        gap: 8,
        fontSize: 14,
        fontWeight: 500,
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        transform: 'translateY(0)',
        transition: 'transform 200ms ease-out',
      }}
    >
      <WifiOff size={16} aria-hidden />
      <span>{t('toast')}</span>
    </div>
  )
}
