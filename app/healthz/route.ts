/**
 * GET /healthz — Supabase liveness probe
 *
 * Verifies the Supabase project is awake by performing a HEAD-style count
 * query against the `clients` table. The daily Contabo cron (plan 05) hits
 * this endpoint to prevent free-tier project pause-on-7-days-idle (Pitfall 5).
 *
 * Always returns HTTP 200 — DB up/down is signaled in the JSON body.
 * (`ok: true / false`, `db: 'ok' / 'down'`). HTTP 200 keeps the cron healthy;
 * the boolean `ok` field lets external uptime pingers (UptimeRobot, etc.)
 * alert on actual DB failure without triggering cron errors on transient blips.
 *
 * Per <healthz_contract>:
 *   - No runtime = 'edge' — supabase-js needs Node.
 *   - force-dynamic + revalidate = 0 — never cached.
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const ts = new Date().toISOString()

  try {
    const { error } = await supabaseAdmin
      .from('clients')
      .select('id', { head: true, count: 'exact' })
      .limit(1)

    if (error) {
      logger.warn({ err: error.message }, 'healthz db error')
      return NextResponse.json({ ok: false, db: 'down', ts }, { status: 200 })
    }

    return NextResponse.json({ ok: true, db: 'ok', ts }, { status: 200 })
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'healthz unexpected error')
    return NextResponse.json({ ok: false, db: 'down', ts }, { status: 200 })
  }
}
