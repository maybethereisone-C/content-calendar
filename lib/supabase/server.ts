/**
 * lib/supabase/server.ts — Server-only Supabase client singleton
 *
 * Uses SUPABASE_SECRET_KEY (service role key) which bypasses Row Level Security.
 * NEVER import this module from a Client Component or Edge runtime code.
 * All DB/Storage calls must go through server-side code.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * Server-only Supabase admin client.
 * Bypasses RLS — treat all returned data as trusted.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { 'x-client-info': 'concierge-server' },
    },
  }
)
