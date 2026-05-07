'use client'

/**
 * DeletePhotoButton — circular X button (top-right) on client_added gallery
 * photos. Tapping opens a confirm Dialog. Confirm calls the removeAsset
 * Server Action then router.refresh.
 *
 * Per UI-SPEC §"<DeletePhotoButton>" + POST-03:
 *   - 36×36 white circle (rgba(255,255,255,0.95)), top:8 right:8, X icon @18
 *   - All copy resolved via next-intl (`photo.*` namespace)
 *   - On not_removable response → deleteFailedNotRemovable
 *   - On db_error → deleteFailedGeneric
 *
 * Notes:
 *   - This component renders ONLY when the parent already determined
 *     role==='client_added' AND isPending. Defense in depth still lives in
 *     the Server Action (PHOTO-03 — UI hide is not the security boundary).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { removeAsset } from '@/app/c/[token]/post/[id]/actions'

export function DeletePhotoButton({
  postId,
  assetId,
}: {
  postId: string
  assetId: string
}) {
  const t = useTranslations('photo')
  const locale = useLocale()
  const fontStack =
    locale === 'th' ? 'var(--font-thai, inherit)' : 'inherit'
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const onConfirm = () => {
    setError(null)
    startTransition(async () => {
      const res = await removeAsset({ postId, assetId })
      if (res.ok) {
        setOpen(false)
        router.refresh()
      } else {
        setError(
          res.error === 'not_removable'
            ? t('deleteFailedNotRemovable')
            : t('deleteFailedGeneric'),
        )
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={t('deleteAriaLabel')}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              padding: 0,
            }}
          >
            <X size={18} color="var(--text-mut)" aria-hidden />
          </button>
        }
      />

      <DialogContent showCloseButton={false}>
        <DialogTitle style={{ fontFamily: fontStack }}>
          {t('deleteConfirmTitle')}
        </DialogTitle>
        <DialogDescription
          style={{
            fontFamily: fontStack,
            color: 'var(--text-mut)',
          }}
        >
          {t('deleteConfirmBody')}
        </DialogDescription>
        {error && (
          <p
            style={{
              color: 'var(--counter-danger-text)',
              fontSize: 12,
              marginTop: 8,
              fontFamily: fontStack,
            }}
          >
            {error}
          </p>
        )}
        <DialogFooter
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            marginTop: 16,
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={isPending}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              minHeight: 44,
              fontFamily: fontStack,
              fontSize: 14,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {t('deleteConfirmCancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--counter-danger-text)',
              color: '#fff',
              minHeight: 44,
              fontFamily: fontStack,
              fontSize: 14,
              fontWeight: 600,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? '…' : t('deleteConfirmPrimary')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
