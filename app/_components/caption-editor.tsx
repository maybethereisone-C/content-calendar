'use client'

/**
 * CaptionEditor — caption textarea with blur-grace save (CAP-01 / D-07).
 *
 * State: react-hook-form FormProvider so CharCounter can subscribe via
 * useWatch without re-rendering the textarea on every keystroke.
 *
 * Save trigger (D-07):
 *   - On blur: schedule a 500ms timer that calls updateCaption.
 *   - On focus: cancel any pending timer (Pitfall 7 — quick blur+focus-back
 *     does NOT double-save).
 *   - If the value matches lastSaved, skip the save (no-op blur).
 *
 * Save outcomes (toast copy via next-intl `toast.*`):
 *   - ok:true              → success toast t('saveSuccess') (auto-clears 4s)
 *   - error 'not_editable' → revert textarea to last saved value;
 *                            error toast t('notEditable') (persists)
 *   - any other error      → keep textarea value; error toast
 *                            t('saveFailed') (persists)
 *
 * Disabled state: when `isPending=false` (post status not pending_review),
 * the textarea is opacity 0.6 + pointer-events: none. CharCounter still
 * shows current length so the read-only viewer sees per-channel counts.
 *
 * Thai IME: react-hook-form's `register` uses native onChange. Composition
 * events (compositionstart/end) fire normally and don't trigger save —
 * save is on blur only.
 */

import { useRef, useState, useTransition, useCallback } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { useTranslations, useLocale } from 'next-intl'
import { Textarea } from '@/components/ui/textarea'
import { CharCounter } from './char-counter'
import { InlineToastBanner, type ToastState } from './inline-toast-banner'
import { type Channel } from '@/lib/channel-limits'
import { updateCaption } from '@/app/c/[token]/post/[id]/actions'

interface FormShape {
  caption: string
}

const SAVE_GRACE_MS = 500

export function CaptionEditor({
  postId,
  initialCaption,
  isPending,
  channels,
}: {
  postId: string
  initialCaption: string
  isPending: boolean
  channels: Channel[]
}) {
  const t = useTranslations('toast')
  const tPost = useTranslations('post')
  const locale = useLocale()
  const fontStack =
    locale === 'th' ? 'var(--font-thai, inherit)' : 'inherit'

  const methods = useForm<FormShape>({
    defaultValues: { caption: initialCaption },
  })
  const { register, getValues, setValue, control } = methods
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef(initialCaption)
  const [toast, setToast] = useState<ToastState>({ kind: 'idle' })
  const [, startTransition] = useTransition()
  const [focused, setFocused] = useState(false)

  const clearToast = useCallback(() => setToast({ kind: 'idle' }), [])

  const handleBlur = () => {
    setFocused(false)
    if (!isPending) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const v = getValues('caption')
      if (v === lastSaved.current) return // no-op blur
      startTransition(async () => {
        const res = await updateCaption({ postId, newCaption: v })
        if (res.ok) {
          lastSaved.current = v
          setToast({ kind: 'success', message: t('saveSuccess') })
        } else if (res.error === 'not_editable') {
          // Status changed under us — revert and show persistent error.
          setValue('caption', lastSaved.current)
          setToast({ kind: 'error', message: t('notEditable') })
        } else {
          // Network/db/validation error — keep value, prompt retry on next blur.
          setToast({ kind: 'error', message: t('saveFailed') })
        }
      })
    }, SAVE_GRACE_MS)
  }

  const handleFocus = () => {
    setFocused(true)
    // Cancel any pending save if user re-focuses within the 500ms grace window.
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
  }

  // shadcn Textarea uses Tailwind classes that may interfere with the
  // explicit visual contract from UI-SPEC. We override via inline style
  // (UI-SPEC color/border tokens are CSS vars, so style= takes precedence).
  return (
    <FormProvider {...methods}>
      <InlineToastBanner state={toast} onAutoClear={clearToast} />

      <div style={{ position: 'relative' }}>
        <Textarea
          {...register('caption')}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={!isPending}
          aria-label={tPost('captionAriaLabel')}
          rows={6}
          style={{
            width: '100%',
            background: focused
              ? 'var(--editor-bg-focus)'
              : 'var(--editor-bg-idle)',
            border: focused
              ? '2px solid var(--accent)'
              : '1px solid transparent',
            borderRadius: 12,
            padding: focused ? '13px 15px' : '14px 16px',
            fontSize: 14,
            lineHeight: 1.6,
            fontFamily: fontStack,
            color: 'var(--text)',
            resize: 'none',
            minHeight: 120,
            maxHeight: '50dvh',
            overflowY: 'auto',
            outline: 'none',
            boxShadow: focused ? 'var(--editor-focus-ring)' : 'none',
            opacity: isPending ? 1 : 0.6,
            pointerEvents: isPending ? 'auto' : 'none',
            transition:
              'background 120ms ease, border-color 120ms ease, padding 120ms ease',
          }}
        />
      </div>

      <CharCounter channels={channels} control={control} />
    </FormProvider>
  )
}
