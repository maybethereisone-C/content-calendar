'use server'

/**
 * Server Actions for the post detail page (Plan 02-03 / D-07 + D-12 + D-15).
 *
 * updateCaption: guarded UPDATE on `posts.caption_th` + audit row in `events`.
 *
 *   1. Zod validates input shape (postId is uuid; newCaption ≤ 70KB).
 *   2. Reads x-client-id from middleware-injected request headers.
 *   3. Defense in depth (D-12): verifies post.client_id === x-client-id BEFORE
 *      the UPDATE. Mismatch → not_found (no cross-tenant leak per ACCESS-04).
 *   4. Guarded UPDATE: WHERE id = $1 AND status = 'pending_review'. Race-loser
 *      gets 0 rows back → not_editable (CAP-03). DB-level enforcement; no TOCTOU.
 *   5. Append-only events insert with full diff payload {before, after,
 *      length_before, length_after} (LOG-01).
 *   6. Pino logs at action_start + action_end with duration_ms (D-15). Note:
 *      token_prefix is NOT logged here — middleware injects x-client-id and
 *      x-client-slug into request headers but NOT the token prefix; we don't
 *      have a clean way to derive it from the action without re-reading the
 *      cookie. Per execution-notes Note 1, this is one of the legitimate
 *      "can't be derived" cases. post_id + client_id are sufficient for log
 *      correlation.
 */

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const UpdateCaptionInput = z.object({
  postId: z.string().uuid(),
  // 70 KB ceiling: matches Facebook's 63,206 char limit + headroom for char-vs-byte
  // mismatch on Thai (most chars are 3 bytes UTF-8). Anything larger is a client
  // bug or attempted DoS — reject with invalid_input.
  newCaption: z.string().max(70000),
})

export type UpdateCaptionResult =
  | { ok: true }
  | {
      ok: false
      error:
        | 'unauthenticated'
        | 'not_found'
        | 'not_editable'
        | 'db_error'
        | 'invalid_input'
    }

export async function updateCaption(
  raw: { postId: string; newCaption: string },
): Promise<UpdateCaptionResult> {
  const parsed = UpdateCaptionInput.safeParse(raw)
  if (!parsed.success) {
    logger.warn({
      msg: 'action_error',
      action: 'updateCaption',
      error: 'invalid_input',
    })
    return { ok: false, error: 'invalid_input' }
  }
  const { postId, newCaption } = parsed.data

  const h = await headers()
  const clientId = h.get('x-client-id')
  if (!clientId) {
    logger.warn({
      msg: 'action_error',
      action: 'updateCaption',
      error: 'unauthenticated',
    })
    return { ok: false, error: 'unauthenticated' }
  }

  const start = Date.now()
  logger.info({
    msg: 'action_start',
    action: 'updateCaption',
    post_id: postId,
    client_id: clientId,
  })

  // Read existing row for diff payload + cross-tenant guard (D-12).
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('posts')
    .select('caption_th, status, client_id')
    .eq('id', postId)
    .maybeSingle()

  if (fetchErr) {
    logger.error({
      msg: 'action_error',
      action: 'updateCaption',
      post_id: postId,
      error: (fetchErr as { message?: string }).message ?? 'unknown',
    })
    return { ok: false, error: 'db_error' }
  }
  if (!existing) {
    logger.warn({
      msg: 'action_error',
      action: 'updateCaption',
      post_id: postId,
      error: 'not_found',
    })
    return { ok: false, error: 'not_found' }
  }
  if (existing.client_id !== clientId) {
    // Cross-tenant attempt — log as warn but return same not_found shape per
    // ACCESS-04 (no info leak via differentiated responses).
    logger.warn({
      msg: 'action_error',
      action: 'updateCaption',
      post_id: postId,
      error: 'cross_tenant',
    })
    return { ok: false, error: 'not_found' }
  }

  // Guarded UPDATE: only succeeds if status is still pending_review.
  // Race-loser (status changed under us) gets 0 rows back.
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('posts')
    .update({ caption_th: newCaption })
    .eq('id', postId)
    .eq('status', 'pending_review')
    .select('id')

  if (updateErr) {
    logger.error({
      msg: 'action_error',
      action: 'updateCaption',
      post_id: postId,
      error: (updateErr as { message?: string }).message ?? 'unknown',
    })
    return { ok: false, error: 'db_error' }
  }
  if (!updated || updated.length === 0) {
    logger.info({
      msg: 'action_end',
      action: 'updateCaption',
      post_id: postId,
      status: 'rejected_not_pending',
      duration_ms: Date.now() - start,
    })
    return { ok: false, error: 'not_editable' }
  }

  // Append-only events insert. Never UPDATE/DELETE this row (LOG-01).
  const before = existing.caption_th ?? ''
  const { data: eventRow, error: eventErr } = await supabaseAdmin
    .from('events')
    .insert({
      client_id: clientId,
      post_id: postId,
      type: 'caption_edited',
      payload: {
        before,
        after: newCaption,
        length_before: before.length,
        length_after: newCaption.length,
      },
    })
    .select('id')
    .single()

  if (eventErr) {
    // Log but don't fail — caption is saved; events row is audit-only.
    // The user-visible save still succeeded.
    logger.error({
      msg: 'event_insert_failed',
      action: 'updateCaption',
      post_id: postId,
      error: (eventErr as { message?: string }).message ?? 'unknown',
    })
  } else {
    logger.info({
      msg: 'event_inserted',
      action: 'updateCaption',
      event_id: (eventRow as { id: string }).id,
      type: 'caption_edited',
    })
  }

  // Revalidate the page so a fresh server render reflects the new caption.
  revalidatePath(`/c/[token]/post/[id]`, 'page')

  logger.info({
    msg: 'action_end',
    action: 'updateCaption',
    post_id: postId,
    status: 200,
    duration_ms: Date.now() - start,
  })
  return { ok: true }
}

/**
 * removeAsset: soft-delete a client-added photo + best-effort Storage cleanup
 * + events audit row (PHOTO-03 / LOG-01 / threats T-02-04-01..05).
 *
 *   1. Zod validates input (both postId + assetId are uuids).
 *   2. Reads x-client-id from middleware-injected request headers.
 *   3. Fetches asset to snapshot storage_path + verify cross-tenant + not
 *      already-deleted (D-12 defense in depth — DB UPDATE also enforces).
 *   4. Guarded UPDATE: WHERE id=$1 AND client_id=$2 AND role='client_added'
 *      AND deleted_at IS NULL. Tew_prepared photos return 0 rows = not_removable
 *      (PHOTO-03 forge defense — UI hides the button but API enforces).
 *   5. Storage.remove is best-effort: if it fails, log + continue. DB is the
 *      source of truth; orphaned Storage objects can be cleaned by a janitor
 *      in v1.1. Events payload records the failure for the audit trail.
 *   6. Append-only events insert with payload {asset_id, storage_path, role,
 *      storage_remove_error?} (LOG-01).
 *   7. Pino action_start + action_end with duration_ms (D-15).
 */
const RemoveAssetInput = z.object({
  postId: z.string().uuid(),
  assetId: z.string().uuid(),
})

export type RemoveAssetResult =
  | { ok: true }
  | {
      ok: false
      error:
        | 'unauthenticated'
        | 'not_found'
        | 'not_removable'
        | 'db_error'
        | 'invalid_input'
    }

export async function removeAsset(
  raw: { postId: string; assetId: string },
): Promise<RemoveAssetResult> {
  const parsed = RemoveAssetInput.safeParse(raw)
  if (!parsed.success) {
    logger.warn({
      msg: 'action_error',
      action: 'removeAsset',
      error: 'invalid_input',
    })
    return { ok: false, error: 'invalid_input' }
  }
  const { postId, assetId } = parsed.data

  const h = await headers()
  const clientId = h.get('x-client-id')
  if (!clientId) {
    logger.warn({
      msg: 'action_error',
      action: 'removeAsset',
      error: 'unauthenticated',
    })
    return { ok: false, error: 'unauthenticated' }
  }

  const start = Date.now()
  logger.info({
    msg: 'action_start',
    action: 'removeAsset',
    post_id: postId,
    asset_id: assetId,
    client_id: clientId,
  })

  // Read for cross-tenant + role check + storage_path snapshot.
  const { data: asset, error: fetchErr } = await supabaseAdmin
    .from('post_assets')
    .select('id, post_id, client_id, role, storage_path, deleted_at')
    .eq('id', assetId)
    .eq('post_id', postId)
    .maybeSingle()

  if (fetchErr) {
    logger.error({
      msg: 'action_error',
      action: 'removeAsset',
      asset_id: assetId,
      error: (fetchErr as { message?: string }).message ?? 'unknown',
    })
    return { ok: false, error: 'db_error' }
  }

  // Cross-tenant or already-deleted both surface as not_found (no info leak).
  if (
    !asset ||
    (asset as { client_id: string }).client_id !== clientId ||
    (asset as { deleted_at: string | null }).deleted_at !== null
  ) {
    logger.warn({
      msg: 'action_error',
      action: 'removeAsset',
      asset_id: assetId,
      error: 'not_found_or_cross_tenant_or_deleted',
    })
    return { ok: false, error: 'not_found' }
  }

  const assetTyped = asset as {
    id: string
    post_id: string
    client_id: string
    role: 'tew_prepared' | 'client_added'
    storage_path: string
    deleted_at: string | null
  }

  // Guarded UPDATE: only succeeds if role='client_added' AND deleted_at IS NULL.
  // Tew_prepared photos return 0 rows = not_removable (PHOTO-03 defense in depth).
  // Race-loser (concurrent delete) also returns 0 rows.
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('post_assets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', assetId)
    .eq('client_id', clientId)
    .eq('role', 'client_added')
    .is('deleted_at', null)
    .select('id')

  if (updateErr) {
    logger.error({
      msg: 'action_error',
      action: 'removeAsset',
      asset_id: assetId,
      error: (updateErr as { message?: string }).message ?? 'unknown',
    })
    return { ok: false, error: 'db_error' }
  }
  if (!updated || (updated as unknown[]).length === 0) {
    logger.info({
      msg: 'action_end',
      action: 'removeAsset',
      asset_id: assetId,
      status: 'rejected_not_removable',
      duration_ms: Date.now() - start,
    })
    return { ok: false, error: 'not_removable' }
  }

  // Best-effort storage object remove. If it fails (e.g., bucket not yet
  // created — migration 0002_storage.sql blocked), log and continue. DB is
  // the source of truth; events payload records the failure.
  let storageRemoveError: string | null = null
  const remove = await supabaseAdmin.storage
    .from('post-media')
    .remove([assetTyped.storage_path])
  if (remove.error) {
    storageRemoveError =
      (remove.error as { message?: string }).message ?? 'unknown'
    logger.error({
      msg: 'storage_remove_failed',
      action: 'removeAsset',
      asset_id: assetId,
      storage_path: assetTyped.storage_path,
      error: storageRemoveError,
    })
  }

  // Append-only events insert. Never UPDATE/DELETE this row (LOG-01).
  const { data: eventRow, error: eventErr } = await supabaseAdmin
    .from('events')
    .insert({
      client_id: clientId,
      post_id: postId,
      type: 'photo_removed',
      payload: {
        asset_id: assetId,
        storage_path: assetTyped.storage_path,
        role: assetTyped.role,
        ...(storageRemoveError
          ? { storage_remove_error: storageRemoveError }
          : {}),
      },
    })
    .select('id')
    .single()

  if (eventErr) {
    // Soft-delete already succeeded — caption save analog: log but don't fail.
    logger.error({
      msg: 'event_insert_failed',
      action: 'removeAsset',
      error: (eventErr as { message?: string }).message ?? 'unknown',
    })
  } else {
    logger.info({
      msg: 'event_inserted',
      action: 'removeAsset',
      event_id: (eventRow as { id: string }).id,
      type: 'photo_removed',
    })
  }

  // Revalidate the page so the gallery re-renders without the deleted asset.
  revalidatePath(`/c/[token]/post/[id]`, 'page')

  logger.info({
    msg: 'action_end',
    action: 'removeAsset',
    asset_id: assetId,
    status: 200,
    duration_ms: Date.now() - start,
  })
  return { ok: true }
}
