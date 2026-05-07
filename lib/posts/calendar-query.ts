/**
 * lib/posts/calendar-query.ts — Single-batched calendar feed select (D-10)
 *
 * Per RESEARCH.md Pattern 1: one Supabase call returns posts + nested
 * post_assets, filtered to the current Bangkok-tz month and ordered by
 * `scheduled_for ASC`. Section split is client-side via
 * `lib/posts/section-split.ts` (no second query).
 *
 * Soft-deleted assets are filtered post-hoc rather than via the Supabase
 * `.is('post_assets.deleted_at', null)` filter — that filter on a nested
 * select can over-filter parent posts depending on join shape. Filtering
 * client-side is safer and the dataset is small (one client, one month).
 *
 * Aspect ratio note (Plan 02-02 executor, Rule 3 deviation 2026-05-08):
 *   `post_assets.aspect_ratio` is added in migration 0002_storage.sql, but
 *   that migration is BLOCKED-AWAITING-TEW (Plan 02-01 SUMMARY). Selecting
 *   the column against the live DB fails with `42703 column does not exist`,
 *   blocking the calendar render. The calendar feed only renders the FIRST
 *   photo with `objectFit: cover` — aspect_ratio is irrelevant here and only
 *   matters for the swipeable gallery in Plan 02-04. We omit it from the
 *   SELECT until 0002 lands. The `PostAssetRow.aspect_ratio` type field
 *   stays for downstream callers (gallery), defaulted to `null` here.
 */

import { supabaseAdmin } from '@/lib/supabase/server'
import { getBangkokMonthBounds } from '@/lib/format-date'
import type { PostStatus } from '@/lib/post-status'

export interface PostAssetRow {
  id: string
  storage_path: string
  role: 'team_prepared' | 'client_added'
  sort_order: number | null
  aspect_ratio: '1:1' | '4:5' | null
}

export interface CalendarPost {
  id: string
  scheduled_for: string
  status: PostStatus
  channel_ids: string[]
  caption_th: string | null
  post_assets: PostAssetRow[]
}

/**
 * Fetch posts for a client within "this month in Bangkok".
 *
 * @param clientId - UUID from middleware-injected `x-client-id` header.
 * @param now - The "current time" used to compute month bounds (default: real now).
 * @throws Error('fetchCalendarPosts_db_error: ...') on Supabase error.
 */
export async function fetchCalendarPosts(
  clientId: string,
  now: Date = new Date(),
): Promise<CalendarPost[]> {
  const { startUtc, endUtc } = getBangkokMonthBounds(now)

  const { data, error } = await supabaseAdmin
    .from('posts')
    .select(
      `
      id, scheduled_for, status, channel_ids, caption_th,
      post_assets(id, storage_path, role, sort_order, deleted_at)
    `,
    )
    .eq('client_id', clientId)
    .gte('scheduled_for', startUtc)
    .lt('scheduled_for', endUtc)
    .order('scheduled_for', { ascending: true })

  if (error) {
    throw new Error(`fetchCalendarPosts_db_error: ${error.message}`)
  }
  if (!data) return []

  return data.map((p) => ({
    ...p,
    // Filter soft-deleted post-hoc + default aspect_ratio to null (column
    // not yet in live DB; see header note).
    post_assets: (p.post_assets ?? [])
      .filter(
        (a: { deleted_at: string | null }) => a.deleted_at === null,
      )
      .map(
        (a: {
          id: string
          storage_path: string
          role: 'team_prepared' | 'client_added'
          sort_order: number | null
        }) => ({ ...a, aspect_ratio: null as '1:1' | '4:5' | null }),
      ),
  })) as unknown as CalendarPost[]
}
