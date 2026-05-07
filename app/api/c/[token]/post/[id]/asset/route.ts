/**
 * POST /api/c/[token]/post/[id]/asset (Plan 02-05 Task 1 — PHOTO-01..05, LOG-01)
 *
 * Photo upload pipeline:
 *   1. Validate params (postId is uuid).
 *   2. Read x-client-id + x-client-slug from middleware-injected headers.
 *   3. Perimeter Content-Length check (Caddy already enforces 25MB; defense in depth).
 *   4. Parse multipart formData; verify file size ≤ 25MB.
 *   5. Cross-tenant guard (D-12): verify post.client_id === x-client-id BEFORE
 *      any Sharp / Storage / DB write.
 *   6. processPhoto (HEIC pre-decode + Sharp resize + EXIF strip — Plan 02-01).
 *   7. Storage upload to post-media/<client_slug>/<post_id>/<post_id>-<nanoid(10)>.jpg.
 *   8. post_assets insert; on failure → storage.remove rollback to keep DB+Storage consistent.
 *   9. events insert (type='photo_added', full payload — LOG-01).
 *  10. Return 200 + asset row + public_url.
 *
 * Logging (D-15):
 *   action_start  → on entry (post_id, client_id)
 *   action_error  → on validation / cross-tenant / db error (warn or error)
 *   action_end    → on success (post_id, asset_id, status=200, duration_ms)
 *
 * Threats mitigated (see <threat_model> in plan):
 *   - T-02-05-01 Tampering Content-Type: isHEIC sniffs magic bytes (Plan 02-01).
 *   - T-02-05-02 DoS 30MB upload: Caddy 25MB + content-length + body size = 3 layers.
 *   - T-02-05-03 Image bomb: Sharp resize cap 2048 + sequential upload (D-06 client side).
 *   - T-02-05-04 EXIF GPS leak: Sharp default strips metadata; exif-smoke.ts verifies.
 *   - T-02-05-05 Path traversal: filename is server-generated; user filename DISCARDED.
 *   - T-02-05-06 Cross-tenant forge: middleware injects x-client-id; route re-checks.
 *   - T-02-05-07 Race window: same processed.jpegBuffer written to Storage and recorded in DB.
 *   - T-02-05-08 Orphan on insert fail: storage.remove rollback.
 *   - T-02-05-11 events tamper: append-only by convention.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'
import { processPhoto } from '@/lib/photo-pipeline/process'
import { logger } from '@/lib/logger'

// Sharp + heic-convert + supabase-js need Node, not Edge.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 25 * 1024 * 1024
const TooLargePayload = {
  ok: false as const,
  error: 'file_too_large' as const,
  message_th: 'ไฟล์ใหญ่เกินไป (สูงสุด 25 MB)',
}

const ParamsSchema = z.object({ id: z.string().uuid() })

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string; id: string }> },
) {
  const start = Date.now()

  // Validate path params.
  let postId: string
  try {
    const parsed = ParamsSchema.parse(await ctx.params)
    postId = parsed.id
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_post_id' },
      { status: 400 },
    )
  }

  const h = await headers()
  const clientId = h.get('x-client-id')
  const clientSlug = h.get('x-client-slug')

  if (!clientId || !clientSlug) {
    logger.warn({
      msg: 'action_error',
      action: 'uploadAsset',
      error: 'unauthenticated',
    })
    return NextResponse.json(
      { ok: false, error: 'unauthenticated' },
      { status: 401 },
    )
  }

  logger.info({
    msg: 'action_start',
    action: 'uploadAsset',
    post_id: postId,
    client_id: clientId,
  })

  // Perimeter Content-Length check — defense in depth (Caddy already enforces).
  const contentLengthHeader = req.headers.get('content-length')
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
    logger.warn({
      msg: 'action_error',
      action: 'uploadAsset',
      error: 'file_too_large_header',
      size: contentLength,
    })
    return NextResponse.json(TooLargePayload, { status: 413 })
  }

  // Parse multipart.
  let form: FormData
  try {
    form = await req.formData()
  } catch (err) {
    logger.warn({
      msg: 'action_error',
      action: 'uploadAsset',
      error: 'multipart_parse_failed',
      detail: (err as Error).message,
    })
    return NextResponse.json(
      { ok: false, error: 'multipart_parse_failed' },
      { status: 400 },
    )
  }

  const file = form.get('file')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: 'no_file' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    logger.warn({
      msg: 'action_error',
      action: 'uploadAsset',
      error: 'file_too_large_body',
      size: file.size,
    })
    return NextResponse.json(TooLargePayload, { status: 413 })
  }

  // Cross-tenant guard (D-12).
  const { data: post, error: postErr } = await supabaseAdmin
    .from('posts')
    .select('id, client_id, status')
    .eq('id', postId)
    .maybeSingle()
  if (postErr) {
    logger.error({
      msg: 'action_error',
      action: 'uploadAsset',
      post_id: postId,
      error: (postErr as { message?: string }).message ?? 'unknown',
    })
    return NextResponse.json(
      { ok: false, error: 'db_error' },
      { status: 500 },
    )
  }
  if (
    !post ||
    (post as { client_id: string }).client_id !== clientId
  ) {
    logger.warn({
      msg: 'action_error',
      action: 'uploadAsset',
      post_id: postId,
      error: 'not_found_or_cross_tenant',
    })
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // Sharp pipeline (with HEIC pre-decode if needed — handled inside processPhoto).
  const inputBuffer = Buffer.from(await file.arrayBuffer())
  const inputMime = file.type || 'application/octet-stream'

  let processed: Awaited<ReturnType<typeof processPhoto>>
  try {
    processed = await processPhoto(inputBuffer, inputMime)
  } catch (e) {
    const err = e as Error
    logger.error({
      msg: 'photo_pipeline_failed',
      action: 'uploadAsset',
      post_id: postId,
      input_mime: inputMime,
      error: err.message,
    })
    return NextResponse.json(
      { ok: false, error: 'process_failed' },
      { status: 500 },
    )
  }

  const filename = `${postId}-${nanoid(10)}.jpg`
  const storagePath = `${clientSlug}/${postId}/${filename}`

  // Upload to Storage.
  const upload = await supabaseAdmin.storage
    .from('post-media')
    .upload(storagePath, processed.jpegBuffer, {
      contentType: 'image/jpeg',
      cacheControl: '604800', // 7 days — matches sw.ts CacheFirst maxAge
      upsert: false,
    })
  if (upload.error) {
    logger.error({
      msg: 'storage_upload_failed',
      action: 'uploadAsset',
      post_id: postId,
      error:
        (upload.error as { message?: string }).message ?? 'unknown',
    })
    return NextResponse.json(
      { ok: false, error: 'upload_failed' },
      { status: 500 },
    )
  }

  // Insert post_assets row. aspect_ratio column added in migration
  // 0002_storage.sql; if the column doesn't exist yet (BLOCKED-AWAITING-TEW
  // per Plan 02-01 SUMMARY), retry the insert WITHOUT aspect_ratio so uploads
  // still succeed. The gallery defaults to '4:5' for null aspect_ratio rows
  // (matches W4 SUMMARY defensive pattern). Once 0002 lands, both branches
  // succeed and aspect_ratio gets persisted.
  let asset:
    | {
        id: string
        storage_path: string
        role: string
        sort_order: number
        aspect_ratio: '1:1' | '4:5' | null
      }
    | null = null
  let insertErr: { message?: string; code?: string } | null = null

  const firstAttempt = await supabaseAdmin
    .from('post_assets')
    .insert({
      post_id: postId,
      client_id: clientId,
      storage_path: storagePath,
      role: 'client_added',
      sort_order: 999,
      aspect_ratio: processed.aspectRatio,
    })
    .select('id, storage_path, role, sort_order, aspect_ratio')
    .single()

  if (
    firstAttempt.error &&
    (firstAttempt.error as { code?: string; message?: string }).code === '42703'
  ) {
    // Migration 0002 not applied yet — retry without aspect_ratio.
    logger.warn({
      msg: 'aspect_ratio_column_missing_retrying',
      action: 'uploadAsset',
      post_id: postId,
    })
    const retry = await supabaseAdmin
      .from('post_assets')
      .insert({
        post_id: postId,
        client_id: clientId,
        storage_path: storagePath,
        role: 'client_added',
        sort_order: 999,
      })
      .select('id, storage_path, role, sort_order')
      .single()
    if (retry.error || !retry.data) {
      insertErr = retry.error as { message?: string; code?: string } | null
    } else {
      const r = retry.data as {
        id: string
        storage_path: string
        role: string
        sort_order: number
      }
      asset = { ...r, aspect_ratio: null }
    }
  } else if (firstAttempt.error || !firstAttempt.data) {
    insertErr = firstAttempt.error as { message?: string; code?: string } | null
  } else {
    asset = firstAttempt.data as unknown as {
      id: string
      storage_path: string
      role: string
      sort_order: number
      aspect_ratio: '1:1' | '4:5' | null
    }
  }

  if (insertErr || !asset) {
    // Roll back the storage upload — keep DB and Storage consistent.
    try {
      await supabaseAdmin.storage.from('post-media').remove([storagePath])
    } catch (rbErr) {
      logger.error({
        msg: 'storage_rollback_failed',
        action: 'uploadAsset',
        storage_path: storagePath,
        error: (rbErr as Error).message,
      })
    }
    logger.error({
      msg: 'action_error',
      action: 'uploadAsset',
      post_id: postId,
      error:
        (insertErr as { message?: string } | null)?.message ?? 'asset_insert_no_row',
    })
    return NextResponse.json(
      { ok: false, error: 'db_error' },
      { status: 500 },
    )
  }

  const assetTyped = asset as {
    id: string
    storage_path: string
    role: string
    sort_order: number
    aspect_ratio: '1:1' | '4:5' | null
  }

  // Append-only events insert (LOG-01). Errors logged but do NOT fail the action.
  try {
    const eventResult = await supabaseAdmin.from('events').insert({
      client_id: clientId,
      post_id: postId,
      type: 'photo_added',
      payload: {
        asset_id: assetTyped.id,
        storage_path: storagePath,
        width: processed.width,
        height: processed.height,
        aspect_ratio: processed.aspectRatio,
        original_size: inputBuffer.length,
        output_size: processed.jpegBuffer.length,
        input_mime: inputMime,
      },
    })
    if (
      eventResult &&
      typeof eventResult === 'object' &&
      'error' in eventResult &&
      (eventResult as { error: unknown }).error
    ) {
      const eErr = (eventResult as { error: { message?: string } }).error
      logger.error({
        msg: 'event_insert_failed',
        action: 'uploadAsset',
        error: eErr.message ?? 'unknown',
      })
    }
  } catch (eErr) {
    logger.error({
      msg: 'event_insert_failed',
      action: 'uploadAsset',
      error: (eErr as Error).message,
    })
  }

  const publicUrl = supabaseAdmin.storage
    .from('post-media')
    .getPublicUrl(assetTyped.storage_path).data.publicUrl

  logger.info({
    msg: 'action_end',
    action: 'uploadAsset',
    post_id: postId,
    asset_id: assetTyped.id,
    status: 200,
    duration_ms: Date.now() - start,
  })

  return NextResponse.json({
    ok: true,
    asset: {
      id: assetTyped.id,
      storage_path: assetTyped.storage_path,
      role: assetTyped.role,
      sort_order: assetTyped.sort_order,
      aspect_ratio: assetTyped.aspect_ratio,
      public_url: publicUrl,
    },
  })
}
