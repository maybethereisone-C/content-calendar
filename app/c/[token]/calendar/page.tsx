import { getTranslations } from 'next-intl/server'
import { CalendarDays } from 'lucide-react'

export const dynamic = 'force-dynamic' // Pitfall 8 prevention

export default async function CalendarPage() {
  const t = await getTranslations('calendar')

  return (
    <section
      className="flex flex-col items-center justify-center text-center"
      style={{
        minHeight: 'calc(100dvh - 56px)',
        gap: 16,
        padding: '0 24px',
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'var(--surface-2)',
          color: 'var(--text-mut)',
        }}
        aria-hidden
      >
        <CalendarDays size={28} />
      </div>
      <p
        style={{
          fontSize: 16,
          color: 'var(--text-mut)',
          lineHeight: 1.5,
          maxWidth: 240,
        }}
      >
        {t('emptyState')}
      </p>
    </section>
  )
}
