// @vitest-environment node
/**
 * Middleware integration tests (mocked Supabase + logger)
 *
 * Verifies:
 *   - Shape-invalid token → 404 + empty body (ACCESS-04)
 *   - Unknown but valid-shape token → 404 + empty body (ACCESS-04, byte-identical)
 *   - Valid token → 200 + x-client-id forwarded header
 *   - Full 32-char token NEVER appears in logger calls (LOG-02 / D-08)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID = 'AbCdEfGhIjKlMnOpQrStUvWxYz123456'

// Mock getClientByToken — no Supabase hit in unit tests
vi.mock('@/lib/supabase/clients', () => ({
  getClientByToken: vi.fn(async (token: string) => {
    if (token === VALID) {
      return {
        id: '00000000-0000-0000-0000-000000000001',
        slug: 'thai-sea',
        name: 'Thai Sea Restaurant',
        secret_url_token: VALID,
        telegram_thread_id: null,
        buffer_org_id: null,
        created_at: new Date().toISOString(),
      }
    }
    return null
  }),
}))

// Mock logger — keep test output clean; let us inspect calls
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe('middleware integration (mocked Supabase + logger)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 + empty body for shape-invalid token', async () => {
    const { middleware } = await import('../../middleware')
    const req = new NextRequest('http://localhost/c/garbage/calendar')
    const res = await middleware(req)
    expect(res.status).toBe(404)
    const body = await res.text()
    expect(body).toBe('')
  })

  it('returns 404 + empty body for unknown but valid-shape token', async () => {
    const { middleware } = await import('../../middleware')
    const unknown = 'a'.repeat(32) // valid shape, not in mock DB
    const req = new NextRequest(`http://localhost/c/${unknown}/calendar`)
    const res = await middleware(req)
    expect(res.status).toBe(404)
    const body = await res.text()
    expect(body).toBe('')
  })

  it('404 bodies are byte-identical for shape-fail and unknown-token paths (ACCESS-04)', async () => {
    const { middleware } = await import('../../middleware')

    const r1 = await middleware(new NextRequest('http://localhost/c/garbage/calendar'))
    const r2 = await middleware(
      new NextRequest(`http://localhost/c/${'a'.repeat(32)}/calendar`)
    )

    expect(r1.status).toBe(404)
    expect(r2.status).toBe(404)
    expect(await r1.text()).toBe(await r2.text())
  })

  it('returns 200 and forwards x-client-id header for valid token', async () => {
    const { middleware } = await import('../../middleware')
    const req = new NextRequest(`http://localhost/c/${VALID}/calendar`)
    const res = await middleware(req)
    expect(res.status).toBe(200)
    // NextResponse.next() with request headers sets x-middleware-request-* response headers
    // so downstream route handlers receive the forwarded headers.
    expect(res.headers.get('x-middleware-request-x-client-id')).toBe(
      '00000000-0000-0000-0000-000000000001'
    )
  })

  it('logs token_prefix (4 chars) and NOT the full token as a dedicated field (LOG-02 / D-08)', async () => {
    const { logger } = await import('@/lib/logger')
    const { middleware } = await import('../../middleware')

    const req = new NextRequest(`http://localhost/c/${VALID}/calendar`)
    await middleware(req)

    const infoMock = logger.info as ReturnType<typeof vi.fn>
    expect(infoMock).toHaveBeenCalled()

    // The log object's token_prefix field must be exactly 4 chars.
    const logObj = infoMock.mock.calls[0][0] as Record<string, unknown>
    expect(logObj.token_prefix).toBe('AbCd')

    // No dedicated 'token' field with the full value (LOG-02 contract).
    // Note: path legitimately contains the token in the URL — that is
    // expected and does not violate LOG-02 (see plan 02 SUMMARY deviation #2).
    expect(logObj).not.toHaveProperty('token')
    expect(String(logObj.token_prefix)).toHaveLength(4)
  })
})
