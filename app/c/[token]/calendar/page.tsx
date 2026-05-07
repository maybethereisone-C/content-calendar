/**
 * /c/[token]/calendar — Calendar feed (CAL-01..CAL-05).
 *
 * RSC. Reads middleware-injected `x-client-id` header, fetches the current
 * Bangkok-month posts via fetchCalendarPosts, splits into two sections
 * (ต้องตรวจ / อนุมัติแล้ว), and renders PostCard rows. Empty section is
 * omitted; both-empty falls back to the Phase 1 empty-state component
 * (per RESEARCH.md Open Question Q3 RESOLUTION).
 *
 * Photo URL resolution:
 *   The seed script stores FULL https URLs as post_assets.storage_path
 *   (Unsplash sample images, not actual Storage uploads — Plan 02-03 / 02-05
 *   exercise real Storage). For dev seed compatibility, we short-circuit on
 *   storage_path values that start with `http(s)://` and pass them through
 *   directly. Real-Storage paths still flow through `getPublicUrl()`.
 *
 * Channel resolution:
 *   posts.channel_ids holds channel UUIDs. We dedupe across all posts on
 *   the page and run a single batched select on `channels` to map UUID →
 *   platform name. Per-card channel_ids are then mapped via that table.
 *
 * Pitfall 8 prevention: `dynamic = 'force-dynamic'` so the page re-renders
 * each request and never serves a stale calendar from the build-time cache.
 */
import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { CalendarDays } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchCalendarPosts } from '@/lib/posts/calendar-query'
import { splitSections } from '@/lib/posts/section-split'
import { type Channel } from '@/lib/channel-limits'
import { PostCard, type PostCardData } from '@/app/_components/post-card'
import { SectionHeader } from '@/app/_components/section-header'

export const dynamic = 'force-dynamic'

const ALLOWED_PLATFORMS: ReadonlyArray<Channel> = [
  'instagram',
  'facebook',
  'tiktok',
  'x',
]

/**
 * Resolve a post_assets.storage_path to a renderable URL.
 *
 * - `http://` / `https://` → return as-is (dev seed Unsplash URLs).
 * - bucket-relative path → compose via `storage.getPublicUrl()`.
 */
function resolvePhotoUrl(storagePath: string): string {
  if (/^https?:\/\//.test(storagePath)) return storagePath
  return supabaseAdmin.storage.from('post-media').getPublicUrl(storagePath).data
    .publicUrl
}

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Middleware injects x-client-id after token validation. Defense-in-depth:
  // throw if missing (matcher misconfiguration would be the only reason).
  const h = await headers()
  const clientId = h.get('x-client-id')
  if (!clientId) {
    throw new Error('missing_x_client_id_middleware_misconfigured')
  }

  const t = await getTranslations('calendar')
  const posts = await fetchCalendarPosts(clientId)

  // ── Resolve channel_ids → platform names via single batched select ─────
  const allChannelIds = Array.from(new Set(posts.flatMap((p) => p.channel_ids)))
  const channelPlatformMap = new Map<string, Channel>()
  if (allChannelIds.length > 0) {
    const { data: channelRows } = await supabaseAdmin
      .from('channels')
      .select('id, platform')
      .in('id', allChannelIds)
    for (const row of channelRows ?? []) {
      const platform = row.platform as string
      if ((ALLOWED_PLATFORMS as ReadonlyArray<string>).includes(platform)) {
        channelPlatformMap.set(row.id as string, platform as Channel)
      }
    }
  }

  // ── Map CalendarPost → PostCardData ────────────────────────────────────
  const cardData: PostCardData[] = posts.map((p) => {
    const sortedAssets = [...p.post_assets].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    // Prefer the first `tew_prepared` asset; fall back to the first asset.
    const tewFirst =
      sortedAssets.find((a) => a.role === 'tew_prepared') ?? sortedAssets[0]
    const url = tewFirst ? resolvePhotoUrl(tewFirst.storage_path) : null
    const platforms = p.channel_ids
      .map((id) => channelPlatformMap.get(id))
      .filter((x): x is Channel => x !== undefined)
    return {
      id: p.id,
      scheduled_for: p.scheduled_for,
      status: p.status,
      caption_th: p.caption_th,
      first_photo_url: url,
      platforms,
    }
  })

  // ── Split + reattach (splitSections only sees the status column) ───────
  const { needsReview, approved } = splitSections(cardData)

  // ── Both empty → Phase 1 empty-state component (continuity) ────────────
  if (needsReview.length === 0 && approved.length === 0) {
    return (
      <section
        className="flex flex-col items-center justify-center text-center"
        style={{
          minHeight: 'calc(100dvh - 56px)',
          gap: 16,
          padding: '0 24px',
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'var(--surface-2)',
            color: 'var(--text-mut)',
          }}
          aria-hidden
        >
          <CalendarDays size={28} />
        </div>
        <p
          style={{
            fontSize: 16,
            color: 'var(--text-mut)',
            lineHeight: 1.5,
            maxWidth: 240,
          }}
        >
          {t('emptyState')}
        </p>
      </section>
    )
  }

  // ── Sectioned list ─────────────────────────────────────────────────────
  return (
    <main style={{ padding: '0 0 24px' }}>
      <SectionHeader
        label={t('sectionNeedsReview')}
        count={needsReview.length}
      />
      {needsReview.length > 0 && (
        <ul
          role="list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 0,
            margin: 0,
            listStyle: 'none',
          }}
        >
          {needsReview.map((p) => (
            <li key={p.id}>
              <PostCard token={token} post={p} />
            </li>
          ))}
        </ul>
      )}
      <SectionHeader label={t('sectionApproved')} count={approved.length} />
      {approved.length > 0 && (
        <ul
          role="list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 0,
            margin: 0,
            listStyle: 'none',
          }}
        >
          {approved.map((p) => (
            <li key={p.id}>
              <PostCard token={token} post={p} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
