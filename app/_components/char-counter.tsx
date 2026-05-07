'use client'

/**
 * CharCounter — per-channel live character counter rows (POST-02 / D-11).
 *
 * Watches the `caption` field of the parent FormProvider via react-hook-form's
 * `useWatch` (re-renders only on caption change, not other form fields).
 * Renders one row per destination channel of the current post — NOT all 4
 * always (per CONTEXT D-11).
 *
 * Color thresholds (per UI-SPEC §CharCounter):
 *   count < limit * 0.9            → --text-mut (default, weight 600)
 *   count >= limit * 0.9 && <=1.0  → --warn-fg  (amber, weight 600)
 *   count > limit                  → --danger-fg (red, weight 700)
 *
 * Channel limits source of truth: lib/channel-limits.ts.
 */
import { useWatch, type Control } from 'react-hook-form'
import { CHANNEL_LIMITS, CHANNEL_LABEL, type Channel } from '@/lib/channel-limits'

interface FormShape {
  caption: string
}

export function CharCounter({
  channels,
  control,
}: {
  channels: Channel[]
  control: Control<FormShape>
}) {
  const caption = useWatch({ control, name: 'caption' }) ?? ''
  const len = caption.length

  return (
    <ul
      role="list"
      style={{
        listStyle: 'none',
        padding: 0,
        margin: '12px 0 0',
      }}
    >
      {channels.map((ch, idx) => {
        const limit = CHANNEL_LIMITS[ch]
        const ratio = len / limit
        const color =
          ratio > 1
            ? 'var(--danger-fg)'
            : ratio >= 0.9
              ? 'var(--warn-fg)'
              : 'var(--text-mut)'
        const weight = ratio > 1 ? 700 : 600
        const isLast = idx === channels.length - 1
        return (
          <li
            key={ch}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0',
              borderBottom: isLast ? 'none' : '1px solid var(--border)',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-mut)',
              }}
            >
              {CHANNEL_LABEL[ch]}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: weight,
                color,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {len.toLocaleString('en-US')} / {limit.toLocaleString('en-US')}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
