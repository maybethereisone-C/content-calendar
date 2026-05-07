/**
 * Post detail page (Plan 02-03 / POST-01) — RSC fetching post + nested
 * post_assets in a single batched query, plus channel platforms via a
 * separate select keyed off `post.channel_ids`.
 *
 * Layout (per UI-SPEC §"Post detail page"):
 *   [back link]
 *   [photo gallery — PostDetailGallery, scroll-snap + dot indicator]
 *   [channels strip + scheduled time]
 *   [caption editor + char counter]
 *
 * Defense in depth (D-12): page verifies `post.client_id === x-client-id`
 * (middleware-injected) and 404s on mismatch — preserves no-info-leak per
 * ACCESS-04. The Server Action repeats the check (DB enforcement is the
 * canonical guard; the page guard is a fast-path hint).
 *
 * Aspect ratio note (Wave 4 executor 2026-05-08): post_assets.aspect_ratio
 * is NOT selected here — column doesn't exist in live DB until migration
 * 0002_storage.sql applies (BLOCKED-AWAITING-TEW per Plan 02-01 SUMMARY).
 * The gallery defaults to '4:5' when aspect_ratio is null. Plan 02-05
 * (upload pipeline) writes the resolved ProcessedPhoto.aspectRatio into
 * the column at upload time. Once migration lands, add `aspect_ratio` to
 * the SELECT and pipe it through to GalleryAsset.aspectRatio.
 */
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { ChevronLeft } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase/server'
import { formatBangkokDateTime, type DateLocale } from '@/lib/format-date'
import { CHANNEL_LABEL, CHANNEL_ORDER, type Channel } from '@/lib/channel-limits'
import { type PostStatus } from '@/lib/post-status'
import { ChannelBadge } from '@/app/_components/channel-badge'
import { CaptionEditor } from '@/app/_components/caption-editor'
import {
  PostDetailGallery,
  type GalleryAsset,
} from '@/app/_components/post-detail-gallery'

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
  const tChannel = await getTranslations('channel')
  const localeRaw = await getLocale()
  const locale: DateLocale = localeRaw === 'th' ? 'th' : 'en'
  const fontStack =
    locale === 'th' ? 'var(--font-thai, inherit)' : 'inherit'

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

  // Build the gallery feed: filter soft-deleted, sort by sort_order, resolve
  // public URLs. aspect_ratio is NOT in the SELECT (migration 0002_storage.sql
  // BLOCKED-AWAITING-TEW per Plan 02-01 SUMMARY); the gallery component
  // defaults to '4:5' when null. Plan 02-05 (upload pipeline) writes
  // ProcessedPhoto.aspectRatio into this column at upload time.
  const rawAssets = (post.post_assets ?? []) as Array<{
    id: string
    storage_path: string
    role: 'team_prepared' | 'client_added'
    sort_order: number | null
    deleted_at: string | null
  }>
  const galleryAssets: GalleryAsset[] = rawAssets
    .filter((a) => a.deleted_at === null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((a) => ({
      id: a.id,
      role: a.role,
      publicUrl: supabaseAdmin.storage
        .from('post-media')
        .getPublicUrl(a.storage_path).data.publicUrl,
      aspectRatio: null, // backfilled by Plan 02-05; gallery defaults to 4:5
    }))

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

      {/* Photo gallery (POST-01 gallery + POST-03 + PHOTO-01 add-photo).
          Plan 02-04 mounted the gallery; Plan 02-05 wires AddPhotoButton via
          the `token` prop. iosFallbackEnabled hardcoded to false until Plan
          02-01 Task 4-B headed verdict lands (per Plan 02-01 SUMMARY
          headed_session_notes.ios_picker_works = pending_tew). Tew can flip
          via env var IOS_PWA_PICKER_FALLBACK once verified. */}
      <PostDetailGallery
        token={token}
        postId={post.id}
        assets={galleryAssets}
        isPending={isPending}
        iosFallbackEnabled={false}
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
            <ChannelBadge
              key={p}
              platform={p}
              ariaLabel={tChannel('ariaLabel', {
                platform: CHANNEL_LABEL[p] ?? p,
              })}
            />
          ))}
        </div>
        {post.scheduled_for && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-mut)',
              fontFamily: fontStack,
            }}
          >
            {formatBangkokDateTime(post.scheduled_for, locale)}
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
          fontFamily: fontStack,
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
