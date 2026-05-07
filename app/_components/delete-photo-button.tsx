'use client'

/**
 * DeletePhotoButton — circular X button (top-right) on client_added gallery
 * photos. Tapping opens a Base UI Dialog "ลบรูปภาพนี้?". Confirm calls the
 * removeAsset Server Action then router.refresh.
 *
 * Per UI-SPEC §"<DeletePhotoButton>" + POST-03:
 *   - 36×36 white circle (rgba(255,255,255,0.95)), top:8 right:8, X icon @18
 *   - aria-label="ลบรูปภาพ"
 *   - Confirm dialog uses Thai copy; primary action is danger-color
 *   - On not_removable response: show "ลบไม่ได้"; on db_error: "ลบไม่สำเร็จ"
 *
 * Notes:
 *   - This component renders ONLY when the parent already determined
 *     role==='client_added' AND isPending. Defense in depth still lives in
 *     the Server Action (PHOTO-03 — UI hide is not the security boundary).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
        setError(res.error === 'not_removable' ? 'ลบไม่ได้' : 'ลบไม่สำเร็จ')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="ลบรูปภาพ"
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
        <DialogTitle style={{ fontFamily: 'var(--font-thai, inherit)' }}>
          ลบรูปภาพนี้?
        </DialogTitle>
        <DialogDescription
          style={{
            fontFamily: 'var(--font-thai, inherit)',
            color: 'var(--text-mut)',
          }}
        >
          การลบจะถาวร — รูปจะหายจากโพสต์นี้
        </DialogDescription>
        {error && (
          <p
            style={{
              color: 'var(--counter-danger-text)',
              fontSize: 12,
              marginTop: 8,
              fontFamily: 'var(--font-thai, inherit)',
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
              fontFamily: 'var(--font-thai, inherit)',
              fontSize: 14,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            ยกเลิก
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
              fontFamily: 'var(--font-thai, inherit)',
              fontSize: 14,
              fontWeight: 600,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? '...' : 'ลบ'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
