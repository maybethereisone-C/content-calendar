/**
 * Post detail page (Plan 02-03 / POST-01) — RSC fetching post + nested
 * post_assets in a single batched query, plus channel platforms via a
 * separate select keyed off `post.channel_ids`.
 *
 * Layout (per UI-SPEC §"Post detail page"):
 *   [back link]
 *   [gallery placeholder slot — Plan 02-04 fills this]
 *   [channels strip + scheduled time]
 *   [caption editor + char counter]
 *
 * Defense in depth (D-12): page verifies `post.client_id === x-client-id`
 * (middleware-injected) and 404s on mismatch — preserves no-info-leak per
 * ACCESS-04. The Server Action repeats the check (DB enforcement is the
 * canonical guard; the page guard is a fast-path hint).
 *
 * Aspect ratio note (Wave 3 executor 2026-05-08): post_assets.aspect_ratio
 * is NOT selected here — column doesn't exist in live DB until migration
 * 0002_storage.sql applies (BLOCKED-AWAITING-TEW per Plan 02-01 SUMMARY).
 * Plan 02-04 (gallery) re-adds it to the SELECT after migration lands.
 */
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ChevronLeft } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase/server'
import { formatBangkokDateTime } from '@/lib/format-date'
import { CHANNEL_ORDER, type Channel } from '@/lib/channel-limits'
import { type PostStatus } from '@/lib/post-status'
import { ChannelBadge } from '@/app/_components/channel-badge'
import { CaptionEditor } from '@/app/_components/caption-editor'

export const dynamic = 'force-dynamic'

interface ChannelRow {
  id: string
  platform: string
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>
}) {
  const { token, id } = await params
  const h = await headers()
  const clientId = h.get('x-client-id')
  // Middleware MUST inject this; if missing, the matcher misconfigured.
  if (!clientId) throw new Error('missing_x_client_id_middleware_misconfigured')

  const t = await getTranslations()

  // Single batched fetch: post + nested post_assets (deleted_at filter applied
  // post-hoc per calendar-query convention to avoid Supabase nested-filter
  // over-filtering).
  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .select(
      `
      id, scheduled_for, status, channel_ids, caption_th, client_id,
      post_assets(id, storage_path, role, sort_order, deleted_at)
    `,
    )
    .eq('id', id)
    .maybeSingle()

  // Defense in depth: 404 on cross-tenant or missing.
  if (error || !post || post.client_id !== clientId) {
    notFound()
  }

  const status = post.status as PostStatus
  const isPending = status === 'pending_review'

  // Resolve channel platforms (CHANNEL_ORDER preserves render order; UI-SPEC
  // §ChannelBadge: "stable order by platform enum").
  let platforms: Channel[] = []
  if (post.channel_ids?.length) {
    const { data: channelRows } = await supabaseAdmin
      .from('channels')
      .select('id, platform')
      .in('id', post.channel_ids)
    platforms = CHANNEL_ORDER.filter((c) =>
      ((channelRows ?? []) as ChannelRow[]).some((r) => r.platform === c),
    )
  }

  return (
    <main
      style={{
        padding: '0 16px 24px',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {/* Back link — 44px tap target per HIG (CAL-05 inverse) */}
      <div style={{ padding: '8px 0' }}>
        <Link
          href={`/c/${token}/calendar`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            minHeight: 44,
            color: 'var(--text-mut)',
            textDecoration: 'none',
            fontSize: 14,
          }}
        >
          <ChevronLeft size={16} aria-hidden /> {t('post.backLink')}
        </Link>
      </div>

      {/* Gallery slot — Plan 02-04 will render <PostDetailGallery /> here.
          Empty placeholder div keeps layout stable across the 02-03 → 02-04
          handoff. The data-attr lets the Plan 02-04 verifier locate the
          slot during smoke testing. */}
      <div
        data-gallery-slot="pending"
        style={{
          marginBottom: 16,
          color: 'var(--text-mut)',
          fontSize: 12,
        }}
      />

      {/* Channels + scheduled time strip (POST-01) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          padding: '8px 0',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {platforms.map((p) => (
            <ChannelBadge key={p} platform={p} />
          ))}
        </div>
        {post.scheduled_for && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-mut)',
              fontFamily: 'var(--font-thai, inherit)',
            }}
          >
            {formatBangkokDateTime(post.scheduled_for)}
          </span>
        )}
      </div>

      {/* Caption editor (CAP-01..03 + POST-02) */}
      <h2
        style={{
          margin: '0 0 8px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-mut)',
          fontFamily: 'var(--font-thai, inherit)',
        }}
      >
        {t('post.caption')}
      </h2>
      <CaptionEditor
        postId={post.id}
        initialCaption={post.caption_th ?? ''}
        isPending={isPending}
        channels={platforms}
      />
    </main>
  )
}
