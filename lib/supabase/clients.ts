/**
 * lib/supabase/clients.ts — Client row lookup by secret URL token
 *
 * Used by middleware (plan 03) and page route handlers.
 * Returns null on miss — never throws — so middleware can return a uniform
 * 404 without leaking DB errors.
 */
import { supabaseAdmin } from './server'

export interface Client {
  id: string
  slug: string
  name: string
  secret_url_token: string
  telegram_thread_id: number | null
  buffer_org_id: string | null
  created_at: string
}

/**
 * Look up a client by their secret URL token.
 *
 * Fast-reject: tokens are exactly 32 chars (D-06, nanoid(32)).
 * Anything shorter/longer skips the DB call entirely.
 *
 * @returns Client row or null on miss/error.
 */
export async function getClientByToken(token: string): Promise<Client | null> {
  // Fast reject — avoids a DB round-trip for obviously wrong tokens.
  if (!token || token.length !== 32) return null

  const { data, error } = await supabaseAdmin
    .from('clients')
    .select(
      'id, slug, name, secret_url_token, telegram_thread_id, buffer_org_id, created_at'
    )
    .eq('secret_url_token', token)
    .maybeSingle()

  if (error) {
    // Do not throw — middleware must return uniform 404, not 500.
    // Middleware logs the error using its own logger reference.
    return null
  }

  return data as Client | null
}
