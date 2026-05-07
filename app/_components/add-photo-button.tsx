'use client'

/**
 * AddPhotoButton — dashed "+" slot at end of PostDetailGallery (PHOTO-01).
 *
 * Behavior (per UI-SPEC §AddPhotoButton + D-05 + D-06):
 *   - Tap opens hidden <input type=file accept="image/*,.heic,.heif" multiple>
 *   - Selected files upload SEQUENTIALLY (D-06: Sharp is single-threaded per call;
 *     parallel uploads on a 1vCPU VPS are catastrophic for memory)
 *   - Per-file spinner overlay shows uploadingCount during in-flight
 *   - Errors render an inline toast banner (Thai); 413 returns the localized message_th
 *     from the API; everything else renders the generic "อัปโหลดไม่สำเร็จ"
 *   - After all uploads, calls router.refresh() so the gallery re-renders with the
 *     new assets
 *   - iOS PWA fallback (D-05): if iosFallbackEnabled prop is true, render an
 *     <a href={iosFallbackUrl} target="_blank"> instead of the button — opens
 *     mobile Safari where <input type=file> is reliably unblocked. Plan 02-01
 *     Task 4-B headed verdict drives the prop; default false until Tew flips.
 *
 * The slot dimensions match the gallery's photoWidth × photoHeight so the layout
 * stays consistent with surrounding photos.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

export function AddPhotoButton({
  token,
  postId,
  isPending,
  width,
  height,
  iosFallbackUrl,
  iosFallbackEnabled = false,
}: {
  token: string
  postId: string
  isPending: boolean
  /** locked aspect from gallery; not used for behavior — purely for slot sizing parity */
  aspectRatio?: '1:1' | '4:5'
  width: number
  height: number
  iosFallbackUrl?: string
  iosFallbackEnabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadingCount, setUploadingCount] = useState(0)
  const router = useRouter()

  const handleClick = () => {
    if (!isPending) return
    if (iosFallbackEnabled) return // anchor handles it
    inputRef.current?.click()
  }

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setError(null)
    setUploadingCount(files.length)

    // Sequential upload (D-06) — Sharp is single-threaded per call; avoid memory pressure.
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch(
          `/api/c/${token}/post/${postId}/asset`,
          {
            method: 'POST',
            body: fd,
          },
        )
        const json: { ok?: boolean; error?: string; message_th?: string } =
          await res.json().catch(() => ({}))
        if (!res.ok || !json.ok) {
          if (res.status === 413 || json.error === 'file_too_large') {
            setError(
              json.message_th ?? 'ไฟล์ใหญ่เกินไป (สูงสุด 25 MB)',
            )
          } else {
            setError('อัปโหลดไม่สำเร็จ')
          }
          break
        }
      } catch {
        setError('อัปโหลดไม่สำเร็จ')
        break
      } finally {
        setUploadingCount((c) => Math.max(0, c - 1))
      }
    }

    // Reset input so the same file can be re-selected later (e.g. after error).
    e.target.value = ''
    router.refresh()
  }

  const slotStyle: React.CSSProperties = {
    flexShrink: 0,
    scrollSnapAlign: 'center',
    width,
    height,
    borderRadius: 12,
    border: '2px dashed var(--border)',
    background: 'var(--surface-2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: isPending ? 'pointer' : 'not-allowed',
    opacity: isPending ? 1 : 0.5,
    textDecoration: 'none',
    color: 'var(--text-mut)',
    position: 'relative',
  }

  // iOS standalone PWA fallback path (D-05).
  if (iosFallbackEnabled && iosFallbackUrl) {
    return (
      <a
        href={iosFallbackUrl}
        target="_blank"
        rel="noopener"
        style={slotStyle}
      >
        <Plus size={32} aria-hidden />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-thai, inherit)',
            textAlign: 'center',
            padding: '0 8px',
          }}
        >
          เปิดในเบราว์เซอร์เพื่ออัปโหลด
        </span>
      </a>
    )
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={!isPending || uploadingCount > 0}
        aria-label="เพิ่มรูป"
        style={{ ...slotStyle, padding: 0 }}
      >
        {uploadingCount > 0 ? (
          <span
            aria-live="polite"
            style={{
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-thai, inherit)',
            }}
          >
            กำลังอัปโหลด {uploadingCount}…
          </span>
        ) : (
          <>
            <Plus size={32} aria-hidden />
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-thai, inherit)',
              }}
            >
              เพิ่มรูป
            </span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        onChange={handleFiles}
        style={{ display: 'none' }}
        aria-hidden
      />
      {error && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--toast-error-bg, #FEE2E2)',
            color: 'var(--counter-danger-text)',
            borderLeft: '4px solid var(--counter-danger-text)',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-thai, inherit)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
