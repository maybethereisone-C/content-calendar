'use client'

/**
 * InlineToastBanner — caption-save feedback (UI-SPEC Q11=3).
 *
 * Inline (NOT floating) banner anchored above the CaptionEditor. Replaces
 * itself on successive saves (next state-set overwrites previous).
 *
 * Auto-dismiss policy (per UI-SPEC §InlineToastBanner):
 *   - success: auto-clears 4s after render (no action required from user)
 *   - error:   persists indefinitely (informational; user navigates away)
 *
 * Note (executor 02-03 — execution-notes Note 2): Errors persist by default
 * behavior — only `success` schedules a timer. The original plan included a
 * `persistent` flag on the error variant, but it was dead code (timer is
 * never scheduled for errors). Field removed for clarity.
 */
import { useEffect } from 'react'
import { Check, AlertCircle } from 'lucide-react'

export type ToastState =
  | { kind: 'idle' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

const SUCCESS_AUTO_CLEAR_MS = 4000

export function InlineToastBanner({
  state,
  onAutoClear,
}: {
  state: ToastState
  onAutoClear: () => void
}) {
  useEffect(() => {
    // Per UI-SPEC: success auto-clears after 4s; error persists.
    if (state.kind === 'success') {
      const t = setTimeout(onAutoClear, SUCCESS_AUTO_CLEAR_MS)
      return () => clearTimeout(t)
    }
  }, [state, onAutoClear])

  if (state.kind === 'idle') return null

  const isSuccess = state.kind === 'success'
  const Icon = isSuccess ? Check : AlertCircle

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 10,
        borderLeft: `4px solid var(${isSuccess ? '--toast-success-border' : '--toast-error-border'})`,
        background: `var(${isSuccess ? '--toast-success-bg' : '--toast-error-bg'})`,
        color: `var(${isSuccess ? '--toast-success-fg' : '--toast-error-fg'})`,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--font-thai, inherit)',
        marginBottom: 12,
      }}
    >
      <Icon size={16} aria-hidden />
      <span>{state.message}</span>
    </div>
  )
}
