'use client'

/**
 * PostDetailGallery — horizontal scroll-snap gallery for the post detail page.
 *
 * Per UI-SPEC §"<PostDetailGallery>" + POST-01 (gallery part) + POST-03:
 *   - CSS scroll-snap-type: x mandatory; scrollSnapAlign: center
 *   - All photos in one post share the same locked aspect (read from
 *     assets[0]?.aspectRatio; pre-migration rows default to 4:5)
 *   - Each photo carries PhotoSourceBadge (top-left) + DeletePhotoButton
 *     (top-right, only on role='client_added' AND isPending)
 *   - Dot indicator below: 6×6 dots; active widens to 18×6 pill in --accent;
 *     updated via IntersectionObserver
 *   - Add-photo slot rendered as the LAST flex item (Plan 02-05 wires upload)
 *
 * Client Component because: scroll observer state (activeIdx) lives here,
 * and DeletePhotoButton (also Client) is rendered conditionally.
 */

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { PhotoSourceBadge } from './photo-source-badge'
import { DeletePhotoButton } from './delete-photo-button'

export interface GalleryAsset {
  id: string
  role: 'tew_prepared' | 'client_added'
  publicUrl: string
  /**
   * From post_assets.aspect_ratio (added in migration 0002_storage.sql /
   * Plan 02-01 Task 3). Plan 02-05 (upload pipeline) writes the resolved
   * aspect from ProcessedPhoto.aspectRatio at upload time. NULL → fallback
   * to '4:5' (more common Instagram portrait; 1:1 photos cover-crop into
   * a 4:5 box harmlessly).
   */
  aspectRatio: '1:1' | '4:5' | null
}

export function PostDetailGallery({
  postId,
  assets,
  isPending,
}: {
  postId: string
  assets: GalleryAsset[]
  /** Controls whether delete buttons + add-photo slot are interactive. */
  isPending: boolean
}) {
  // All photos in one post share the locked aspect from the pipeline.
  // Read from the first asset; default to '4:5' if column is NULL.
  const aspectRatio: '1:1' | '4:5' = assets[0]?.aspectRatio ?? '4:5'
  const [activeIdx, setActiveIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.5) {
            const idx = Number(e.target.getAttribute('data-idx'))
            if (!Number.isNaN(idx)) setActiveIdx(idx)
          }
        }
      },
      { root: container, threshold: [0.5] },
    )
    for (const el of itemRefs.current) {
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [assets.length])

  const photoWidth = 240 // target on 390px viewports
  const photoHeight = aspectRatio === '1:1' ? 240 : 300 // 240×300 for 4:5

  return (
    <div data-gallery-root style={{ marginBottom: 16 }}>
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          padding: '0 16px',
          margin: '0 -16px',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', // Firefox
          willChange: 'scroll-snap-type',
        }}
      >
        {assets.map((asset, idx) => (
          <div
            key={asset.id}
            ref={(el) => {
              itemRefs.current[idx] = el
            }}
            data-idx={idx}
            style={{
              flexShrink: 0,
              scrollSnapAlign: 'center',
              position: 'relative',
              width: photoWidth,
              height: photoHeight,
              borderRadius: 12,
              overflow: 'hidden',
              background: 'var(--surface-2)',
            }}
          >
            <Image
              src={asset.publicUrl}
              alt=""
              fill
              sizes={`${photoWidth}px`}
              loading={idx === 0 ? 'eager' : 'lazy'}
              style={{ objectFit: 'cover' }}
            />
            <PhotoSourceBadge role={asset.role} />
            {asset.role === 'client_added' && isPending && (
              <DeletePhotoButton postId={postId} assetId={asset.id} />
            )}
          </div>
        ))}

        {/* Add-photo slot — Plan 02-05 replaces this stub with <AddPhotoButton />. */}
        <div
          data-add-photo-slot="stub"
          aria-hidden
          style={{
            flexShrink: 0,
            scrollSnapAlign: 'center',
            width: photoWidth,
            height: photoHeight,
            borderRadius: 12,
            border: '2px dashed var(--border)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-mut)',
            fontSize: 12,
            opacity: isPending ? 1 : 0.5,
          }}
        >
          {/* Plan 02-05 fills */}
        </div>
      </div>

      {/* Dot indicator (excludes the add-slot from the count). */}
      {assets.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
            padding: '12px 0 4px',
          }}
        >
          {assets.map((a, idx) => {
            const isActive = idx === activeIdx
            return (
              <span
                key={a.id}
                aria-hidden
                style={{
                  width: isActive ? 18 : 6,
                  height: 6,
                  borderRadius: 999,
                  background: isActive ? 'var(--accent)' : 'var(--border)',
                  transition: 'width 160ms ease, background 160ms ease',
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
