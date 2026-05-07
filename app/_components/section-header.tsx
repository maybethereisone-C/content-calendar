/**
 * SectionHeader — RSC divider for the calendar's two-section list (CAL-04).
 *
 * Renders a 13px/600 muted heading like "ต้องตรวจ · 3" / "อนุมัติแล้ว · 5".
 *
 * Behavior gate per CAL-04: when the section count is 0, the entire header is
 * omitted (no "0 posts" placeholder). Returns null in that case so the parent
 * can render `<SectionHeader … />` unconditionally without ternaries.
 */
export function SectionHeader({
  label,
  count,
}: {
  label: string
  count: number
}) {
  if (count === 0) return null
  return (
    <h2
      style={{
        margin: '24px 0 12px 0',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-mut)',
        fontFamily: 'var(--font-thai, inherit)',
      }}
    >
      {label} · {count}
    </h2>
  )
}
