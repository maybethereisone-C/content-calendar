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
