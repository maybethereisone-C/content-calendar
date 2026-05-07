/**
 * lib/middleware-token.ts — Pure URL token extractor
 *
 * Extracted from middleware.ts so it's unit-testable without standing up a
 * NextRequest mock. Returns the token string when the URL matches the
 * /c/[token]/* or /api/c/[token]/* shape AND the token is 32 chars of the
 * URL-safe nanoid alphabet (D-06, D-07).
 *
 * Returns null on any shape or alphabet mismatch — callers MUST treat null
 * as "respond 404" without revealing which check failed (ACCESS-04).
 */

/** D-07: URL-safe nanoid alphabet, exactly 32 characters. */
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/

/**
 * Extract the client token from a pathname.
 *
 * Supports two URL shapes:
 *   /c/[token]/...           (client-facing pages)
 *   /api/c/[token]/...       (API routes)
 *
 * Returns the token if it passes length (32) and alphabet checks.
 * Returns null on any mismatch — middleware responds with 404.
 */
export function extractTokenFromPath(pathname: string): string | null {
  // Split on '/' and remove empty segments (handles leading/trailing slashes).
  const parts = pathname.split('/').filter(Boolean)

  // Shape:                index  0       1      2
  //   /c/[token]/...      => 'c'     '[token]'  ...
  //   /api/c/[token]/...  => 'api'   'c'        '[token]'  ...
  let token: string | undefined

  if (parts[0] === 'c') {
    token = parts[1]
  } else if (parts[0] === 'api' && parts[1] === 'c') {
    token = parts[2]
  }

  if (!token) return null
  if (!TOKEN_RE.test(token)) return null

  return token
}
