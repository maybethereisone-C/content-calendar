#!/usr/bin/env tsx
/**
 * scripts/seed-calendar.ts — dev seed: ~5 mixed-status posts for one client.
 *
 * Plan 02-02 Task 2. Inserts five posts spread across the current Bangkok
 * month (today, +2d, +5d, -3d, -1d) with mixed statuses so all four chip
 * variants render in the calendar feed. Each post gets 2-3 post_assets
 * rows pointing at public Unsplash sample images — no actual uploads;
 * Plan 02-03 / 02-05 exercise real Storage uploads.
 *
 * Idempotency:
 *   Every seeded post starts its caption_th with the `[SEED]` sentinel.
 *   Re-running the script first deletes ALL posts whose caption starts
 *   with `[SEED]` for this client (cascade also cleans post_assets), then
 *   re-inserts. Safe to run repeatedly.
 *
 * Usage (from app/):
 *   BUFFER_CLIENT=mock TELEGRAM_CLIENT=mock \
 *     npx tsx --env-file=.env.local scripts/seed-calendar.ts <slug>
 *
 * Default slug: `thai-sea`.
 *
 * The `--env-file` flag loads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY.
 * `BUFFER_CLIENT` / `TELEGRAM_CLIENT` are stubbed to `mock` so this script
 * never reaches Buffer / Telegram (defense-in-depth — the script doesn't
 * actually import those clients).
 */

import { createClient } from '@supabase/supabase-js'

// ---- env --------------------------------------------------------------------

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  // eslint-disable-next-line no-console
  console.error(
    'FAIL: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local',
  )
  process.exit(1)
}

const slug = (process.argv[2] ?? 'thai-sea').trim()

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ---- helpers ----------------------------------------------------------------

const SAMPLE_IMAGES = [
  // Public Unsplash photos — small (w=800) so dev pulls stay fast.
  // Storage paths are deliberately external URLs in this seed; the calendar
  // page calls supabaseAdmin.storage.from('post-media').getPublicUrl(path)
  // which would normally compose the bucket URL. For the seed we instead
  // store the FULL Unsplash URL as the storage_path, and the RSC page is
  // updated to short-circuit on `https://` paths (no bucket compose).
  // BUT — to keep the page logic simple, this seed uses storage_path values
  // that are already full URLs and we set the column literally; the calendar
  // page treats anything starting with `http` as a pre-resolved URL.
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
  'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&q=80',
  'https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&q=80',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
  'https://images.unsplash.com/photo-1460978812857-470ed1c77af0?w=800&q=80',
] as const

/**
 * Compute "now in Bangkok" → ISO of {today, +2d, +5d, -3d, -1d} clamped
 * inside the current Bangkok-month window. We don't actually clamp here
 * because the spread is well within ±5 days of today — even at month
 * boundaries the natural-month query in fetchCalendarPosts will pick up
 * whatever remains. Tew can re-run on the 1st and the seed will still
 * land most posts in the visible month.
 */
function offsetIso(offsetDays: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  // Use 10:00 Bangkok = 03:00 UTC for nice rounded times in the UI.
  d.setUTCHours(3, 0, 0, 0)
  return d.toISOString()
}

interface SeedPost {
  scheduled_for: string
  status:
    | 'pending_review'
    | 'approved'
    | 'scheduled'
    | 'needs_team'
    | 'published'
    | 'failed'
  caption_th: string
  asset_count: 2 | 3
}

const SEED_POSTS: SeedPost[] = [
  {
    scheduled_for: offsetIso(0),
    status: 'pending_review',
    caption_th:
      '[SEED] เปิดร้านวันแรก! 🌊 อาหารทะเลสดใหม่จากพี่น้องประมงไทย ส่งตรงถึงดูไบ ลองมื้อแรกของวันใหม่ไปกับเรา',
    asset_count: 3,
  },
  {
    scheduled_for: offsetIso(2),
    status: 'pending_review',
    caption_th:
      '[SEED] เมนูเด็ดประจำสัปดาห์: ต้มยำกุ้งน้ำข้น เผ็ดร้อนถึงใจ พร้อมเสิร์ฟทุกวัน 11:00 - 23:00',
    asset_count: 2,
  },
  {
    scheduled_for: offsetIso(-1),
    status: 'needs_team',
    caption_th:
      '[SEED] ลูกค้าขอแก้แคปชัน — รอทีมงานอัปเดตข้อมูลโปรโมชันใหม่ก่อนปล่อยลง Instagram',
    asset_count: 2,
  },
  {
    scheduled_for: offsetIso(5),
    status: 'scheduled',
    caption_th:
      '[SEED] วันเสาร์นี้ เปิดบริการถึงเที่ยงคืน! จองโต๊ะล่วงหน้าได้ที่ +971 50 123 4567',
    asset_count: 3,
  },
  {
    scheduled_for: offsetIso(-3),
    status: 'published',
    caption_th:
      '[SEED] ขอบคุณทุกท่านที่มาเยือนเมื่อสุดสัปดาห์ที่ผ่านมา ❤️ พบกันใหม่สัปดาห์หน้า',
    asset_count: 2,
  },
]

// ---- main -------------------------------------------------------------------

async function main(): Promise<void> {
  // 1. Look up client by slug.
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, slug, name')
    .eq('slug', slug)
    .single()

  if (clientErr || !client) {
    // eslint-disable-next-line no-console
    console.error(
      `FAIL: client with slug='${slug}' not found. Run npm run db:seed first.`,
    )
    if (clientErr) {
      // eslint-disable-next-line no-console
      console.error('  details:', clientErr.message)
    }
    process.exit(1)
  }

  // eslint-disable-next-line no-console
  console.log(`→ Seeding calendar for client '${client.slug}' (${client.id})`)

  // 2. Ensure Instagram + Facebook channel rows exist (idempotent on conflict).
  //    The schema has no UNIQUE on (client_id, platform) so we select first.
  const requiredPlatforms = ['instagram', 'facebook'] as const
  const { data: existingChannels, error: chSelErr } = await supabase
    .from('channels')
    .select('id, platform')
    .eq('client_id', client.id)
    .in('platform', [...requiredPlatforms])
  if (chSelErr) {
    // eslint-disable-next-line no-console
    console.error('FAIL on channel select:', chSelErr.message)
    process.exit(1)
  }

  const havePlatforms = new Set(
    (existingChannels ?? []).map((c) => c.platform as string),
  )
  const channelInserts = requiredPlatforms
    .filter((p) => !havePlatforms.has(p))
    .map((platform) => ({
      client_id: client.id,
      platform,
      name: `${platform[0]?.toUpperCase() ?? ''}${platform.slice(1)} (seed)`,
    }))

  if (channelInserts.length > 0) {
    const { error: chInsErr } = await supabase
      .from('channels')
      .insert(channelInserts)
    if (chInsErr) {
      // eslint-disable-next-line no-console
      console.error('FAIL on channel insert:', chInsErr.message)
      process.exit(1)
    }
    // eslint-disable-next-line no-console
    console.log(`  + inserted ${channelInserts.length} channel(s)`)
  }

  // Re-fetch to get all channel IDs (those we inserted now have ids).
  const { data: allChannels } = await supabase
    .from('channels')
    .select('id, platform')
    .eq('client_id', client.id)
    .in('platform', [...requiredPlatforms])

  const channelIds = (allChannels ?? []).map((c) => c.id as string)
  if (channelIds.length === 0) {
    // eslint-disable-next-line no-console
    console.error('FAIL: no channels resolved after insert; aborting.')
    process.exit(1)
  }

  // 3. Idempotency: delete prior [SEED] posts for this client.
  //    post_assets cascade via the FK so they go automatically.
  const { error: delErr, count: delCount } = await supabase
    .from('posts')
    .delete({ count: 'exact' })
    .eq('client_id', client.id)
    .like('caption_th', '[SEED]%')
  if (delErr) {
    // eslint-disable-next-line no-console
    console.error('FAIL on prior-seed delete:', delErr.message)
    process.exit(1)
  }
  // eslint-disable-next-line no-console
  console.log(`  − deleted ${delCount ?? 0} prior [SEED] post(s)`)

  // 4. Insert posts + assets.
  let assetCounter = 0
  for (const seed of SEED_POSTS) {
    const { data: insertedPost, error: postErr } = await supabase
      .from('posts')
      .insert({
        client_id: client.id,
        channel_ids: channelIds,
        caption_th: seed.caption_th,
        scheduled_for: seed.scheduled_for,
        status: seed.status,
      })
      .select('id')
      .single()

    if (postErr || !insertedPost) {
      // eslint-disable-next-line no-console
      console.error(
        `FAIL on post insert (status=${seed.status}):`,
        postErr?.message,
      )
      process.exit(1)
    }

    const assetRows = Array.from({ length: seed.asset_count }, (_, i) => {
      const url = SAMPLE_IMAGES[assetCounter % SAMPLE_IMAGES.length]!
      assetCounter += 1
      return {
        post_id: insertedPost.id,
        client_id: client.id,
        // For the seed we stash the full Unsplash URL as the storage_path.
        // The calendar page short-circuits on http(s):// paths and uses the
        // value directly instead of composing a bucket URL — see
        // app/c/[token]/calendar/page.tsx (Plan 02-02 Task 3).
        storage_path: url,
        role: 'team_prepared' as const,
        sort_order: i,
      }
    })

    const { error: assetErr } = await supabase
      .from('post_assets')
      .insert(assetRows)
    if (assetErr) {
      // eslint-disable-next-line no-console
      console.error(
        `FAIL on post_assets insert (post=${insertedPost.id}):`,
        assetErr.message,
      )
      process.exit(1)
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `✓ Seeded ${SEED_POSTS.length} posts (${assetCounter} total photos) for ${client.slug}`,
  )
  // eslint-disable-next-line no-console
  console.log('  Statuses: 2× pending_review · 1× needs_team · 1× scheduled · 1× published')
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('FAIL (unhandled):', err)
  process.exit(1)
})
