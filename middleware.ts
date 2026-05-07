/**
 * middleware.ts — Token-validating gate for /c/[token]/* and /api/c/[token]/*
 *
 * Per SPEC ACCESS-01..04, LOG-02, D-06, D-07, D-08.
 *
 * Pipeline (short-circuit on first fail):
 *   1. extractTokenFromPath — shape + alphabet check (no DB)
 *   2. getClientByToken — DB lookup via unique index
 *
 * On failure → new NextResponse(null, { status: 404 })
 *   - Body is null / empty Uint8Array (ACCESS-04 byte-identical)
 *   - No token in headers, no DB error exposed
 *
 * On success → NextResponse.next({ request: { headers } })
 *   - Forwards x-client-id and x-client-slug so RSCs / route handlers
 *     can read the client without re-querying Supabase
 *
 * Logging (LOG-02):
 *   One structured JSON line per request via pino logger.
 *   token_prefix: first 4 chars only — full token NEVER logged (D-08).
 *
 * Runtime: Node.js (NOT Edge) — pino + supabase-js both need Node.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getClientByToken } from '@/lib/supabase/clients'
import { extractTokenFromPath } from '@/lib/middleware-token'
import { logger } from '@/lib/logger'

// Opt-in to Node.js runtime — pino transport + supabase-js need Node, not Edge.
// Default Next.js middleware runtime is Edge.
export const runtime = 'nodejs'

export async function middleware(req: NextRequest) {
  const start = Date.now()
  const path = req.nextUrl.pathname
  const method = req.method

  const token = extractTokenFromPath(path)

  if (!token) {
    // Shape/alphabet check failed — fast reject.
    // Log with token_prefix null (we don't have a well-formed token).
    const duration_ms = Date.now() - start
    logger.info(
      { method, path, status: 404, duration_ms, client_id: null, token_prefix: null, reason: 'shape' },
      'request'
    )
    return new NextResponse(null, { status: 404 })
  }

  const tokenPrefix = token.slice(0, 4)
  const client = await getClientByToken(token)

  if (!client) {
    const duration_ms = Date.now() - start
    logger.info(
      { method, path, status: 404, duration_ms, client_id: null, token_prefix: tokenPrefix, reason: 'not_found' },
      'request'
    )
    return new NextResponse(null, { status: 404 })
  }

  // Inject forwarded request headers so RSCs / route handlers read x-client-id
  // without re-querying Supabase.  Use `request: { headers }` form of
  // NextResponse.next() — these are REQUEST headers forwarded to the route,
  // not RESPONSE headers (which would not reach the route handler).
  //
  // Plan 02-05 workaround: Next.js 15.5.x has a known bug where Node-runtime
  // middleware that returns NextResponse.next({ request: { headers } }) on a
  // multipart POST causes the route handler to throw "Response body object
  // should not be disturbed or locked" inside framework code
  // (fromNodeNextRequest). The body gets locked by the request clone.
  //
  // For the multipart upload route only, we skip the request-clone path
  // entirely. The route handler does its own client lookup via
  // getClientByToken(token) — middleware still runs the token shape + DB
  // existence check (same defense-in-depth gate), but the route handler
  // re-resolves the client. Performance impact: one extra Supabase round-trip
  // per upload (uploads are slow anyway — Sharp pipeline dominates), and
  // getClientByToken is the same indexed unique lookup the middleware just
  // did.
  const isMultipartUpload =
    method === 'POST' &&
    /^\/api\/c\/[^/]+\/post\/[^/]+\/asset\/?$/.test(path)

  let res: NextResponse
  if (isMultipartUpload) {
    res = NextResponse.next()
  } else {
    const forwardedHeaders = new Headers(req.headers)
    forwardedHeaders.set('x-client-id', client.id)
    forwardedHeaders.set('x-client-slug', client.slug)
    res = NextResponse.next({ request: { headers: forwardedHeaders } })
  }

  const duration_ms = Date.now() - start
  logger.info(
    { method, path, status: 200, duration_ms, client_id: client.id, token_prefix: tokenPrefix },
    'request'
  )

  return res
}

export const config = {
  // Guard /c/* (client pages) and /api/c/* (future API routes — guarded now
  // so Phase 2 routes are automatically protected without config changes).
  matcher: ['/c/:path*', '/api/c/:path*'],
}
