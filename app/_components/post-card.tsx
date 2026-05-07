/**
 * PostCard — RSC card for the calendar feed (CAL-02 / Wave 2 Task 2).
 *
 * Photo-top hero (140px) → meta row (Bangkok date + status chip) → channel
 * badge row → 2-line caption clamp. The whole card is a `next/link` so the
 * tap target spans the full surface (CAL-05).
 *
 * This component does ZERO Supabase work. The calendar page resolves
 * `channel_ids → platforms` via a single batched select and pre-resolves the
 * first-photo public URL via `storage.getPublicUrl()` (no per-card SDK calls).
 *
 * Translation strategy: `chip.labelTh` (รอตรวจ / อนุมัติแล้ว / รอทิว / โพสต์แล้ว)
 * comes from `getStatusChip()` as a verbatim Thai constant — NOT translated
 * via next-intl, per UI-SPEC §"Translation strategy" (same pattern as A2HS).
 *
 * Aria-label encodes "โพสต์วันที่ {date}, สถานะ {label}" so VoiceOver / TalkBack
 * announce both date + status when the card is focused — meets CAL-02 a11y
 * intent without a separate visually-hidden span.
 */
import Link from 'next/link'
import Image from 'next/image'
import { CalendarDays } from 'lucide-react'
import { formatBangkokDate } from '@/lib/format-date'
import { getStatusChip, type PostStatus } from '@/lib/post-status'
import { CHANNEL_ORDER, type Channel } from '@/lib/channel-limits'
import { StatusChip } from './status-chip'
import { ChannelBadge } from './channel-badge'

export interface PostCardData {
  id: string
  scheduled_for: string
  status: PostStatus
  caption_th: string | null
  first_photo_url: string | null
  platforms: Channel[]
}

export function PostCard({
  token,
  post,
}: {
  token: string
  post: PostCardData
}) {
  const chip = getStatusChip(post.status)
  // CHANNEL_ORDER preserves the IG/FB/TikTok/X render order regardless of how
  // the post stored channel_ids — UI-SPEC §"Components / Channel badges".
  const platformsOrdered = CHANNEL_ORDER.filter((c) =>
    post.platforms.includes(c),
  )

  return (
    <Link
      href={`/c/${token}/post/${post.id}`}
      style={{
        display: 'block',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.04))',
      }}
      aria-label={`โพสต์วันที่ ${formatBangkokDate(post.scheduled_for)}, สถานะ ${chip.labelTh}`}
    >
      {/* Photo hero — fixed 140px tall surface-2 background; centered icon
          fallback when no asset is attached (e.g. caption-only draft). */}
      <div
        style={{
          height: 140,
          position: 'relative',
          background: 'var(--surface-2)',
        }}
      >
        {post.first_photo_url ? (
          <Image
            src={post.first_photo_url}
            alt=""
            fill
            sizes="(max-width: 480px) 100vw, 480px"
            loading="lazy"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CalendarDays size={28} color="var(--text-mut)" aria-hidden />
          </span>
        )}
      </div>

      {/* Body — meta row → badge row → caption clamp */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-mut)',
              fontFamily: 'var(--font-thai, inherit)',
            }}
          >
            {formatBangkokDate(post.scheduled_for)}
          </span>
          <StatusChip variant={chip.variant} label={chip.labelTh} />
        </div>

        {platformsOrdered.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {platformsOrdered.map((p) => (
              <ChannelBadge key={p} platform={p} />
            ))}
          </div>
        )}

        {post.caption_th && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontFamily: 'var(--font-thai, inherit)',
            }}
          >
            {post.caption_th}
          </p>
        )}
      </div>
    </Link>
  )
}
