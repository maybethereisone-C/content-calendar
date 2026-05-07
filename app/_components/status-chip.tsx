/**
 * StatusChip — RSC pill mapping ChipVariant → CSS-var palette + Thai label.
 *
 * Per UI-SPEC §Components and CAL-02:
 *   - 999px radius, padding 3px 8px, font 11px/600 thai
 *   - Each variant resolves to its --chip-{variant}-bg / --chip-{variant}-fg pair.
 *     `published` is the exception — UI-SPEC reuses --surface-2 / --text-mut
 *     and intentionally does NOT define a dedicated chip-published var.
 *   - The `label` prop is rendered verbatim. Status text is NOT translated via
 *     next-intl (UI-SPEC §"Translation strategy" — same pattern as Phase 1's
 *     A2HS string constants).
 *   - data-status-chip="{variant}" mirrors the variant for downstream stylesheet
 *     hooks (CSS variant selectors, axe-core fixture lookups).
 *
 * Stateless, no hooks, no state. Safe to render in either RSC or client tree.
 */
import type { ChipVariant } from '@/lib/post-status'

const VARIANT_VARS: Record<ChipVariant, { bg: string; fg: string }> = {
  pending: { bg: 'var(--chip-pending-bg)', fg: 'var(--chip-pending-fg)' },
  approved: { bg: 'var(--chip-approved-bg)', fg: 'var(--chip-approved-fg)' },
  'needs-tew': {
    bg: 'var(--chip-needs-tew-bg)',
    fg: 'var(--chip-needs-tew-fg)',
  },
  // chip-published owns its bg/fg — bg tracks --surface-2 via CSS var aliasing,
  // but fg is darker than --text-mut so 11px normal text clears WCAG AA.
  // Rule 1 fix from executor 02-02; see globals.css comment.
  published: { bg: 'var(--chip-published-bg)', fg: 'var(--chip-published-fg)' },
}

export function StatusChip({
  variant,
  label,
}: {
  variant: ChipVariant
  label: string
}) {
  const v = VARIANT_VARS[variant]
  return (
    <span
      data-status-chip={variant}
      style={{
        display: 'inline-block',
        background: v.bg,
        color: v.fg,
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        fontFamily: 'var(--font-thai, inherit)',
      }}
    >
      {label}
    </span>
  )
}
