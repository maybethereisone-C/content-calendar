import { CalendarDays } from 'lucide-react'

export function BrandMark() {
  return (
    <div
      className="brand-mark flex items-center justify-center"
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: 'var(--accent)',
        color: 'var(--accent-fg)',
        flexShrink: 0,
      }}
      aria-hidden
    >
      <CalendarDays size={16} />
    </div>
  )
}
