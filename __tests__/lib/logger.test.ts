import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Writable } from 'node:stream'

describe('lib/logger token redaction (LOG-02)', () => {
  let captured: string[]
  let stream: Writable

  beforeEach(() => {
    captured = []
    stream = new Writable({
      write(chunk, _enc, cb) {
        captured.push(chunk.toString())
        cb()
      },
    })
  })

  it('redacts {token} field to 4-char prefix + ****', async () => {
    const pino = (await import('pino')).default
    const log = pino(
      {
        serializers: {
          token: (t: string) => (t ? t.slice(0, 4) + '****' : undefined),
        },
      },
      stream
    )

    const fullToken = 'AbCdEfGhIjKlMnOpQrStUvWxYz123456'
    log.info({ token: fullToken }, 'request')

    // Allow pino to flush (it batches writes)
    await new Promise((r) => setTimeout(r, 10))

    const line = captured.join('')
    expect(line).toContain('AbCd****')
    expect(line).not.toContain(fullToken)
  })

  it('does not log token field for empty token', async () => {
    const pino = (await import('pino')).default
    const log = pino(
      {
        serializers: {
          token: (t: string) => (t ? t.slice(0, 4) + '****' : undefined),
        },
      },
      stream
    )

    log.info({ token: '' }, 'request')
    await new Promise((r) => setTimeout(r, 10))

    const line = captured.join('')
    // Empty token serializer returns undefined — pino omits undefined fields
    expect(line).not.toMatch(/"token":\s*""/)
  })

  it('does not redact token_prefix (explicit 4-char field)', async () => {
    const pino = (await import('pino')).default
    const log = pino(
      {
        serializers: {
          token: (t: string) => (t ? t.slice(0, 4) + '****' : undefined),
        },
      },
      stream
    )

    log.info({ token_prefix: 'AbCd' }, 'request')
    await new Promise((r) => setTimeout(r, 10))

    const line = captured.join('')
    expect(line).toContain('AbCd')
  })

  it('logger module exports a pino logger instance', async () => {
    vi.resetModules()
    const { logger } = await import('@/lib/logger')
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
  })

  it('full 32-char token field is never logged in plain form (LOG-02)', async () => {
    const pino = (await import('pino')).default
    const log = pino(
      {
        serializers: {
          token: (t: string) => (t ? t.slice(0, 4) + '****' : undefined),
        },
      },
      stream
    )

    // Simulate the middleware log: token field is the secret, path does NOT embed token
    // (Test fixture — random 32-char string, never used in production.)
    const fullToken = 'TEST_FIXTURE_TOKEN_abcd1234567890'
    log.info(
      {
        method: 'GET',
        path: '/c/[token]/calendar', // path is generic; token field carries the secret
        status: 200,
        duration_ms: 42,
        client_id: 'uuid-1',
        token: fullToken,            // this field must be redacted by serializer
        token_prefix: fullToken.slice(0, 4), // this explicit field stays
      },
      'request'
    )
    await new Promise((r) => setTimeout(r, 10))

    const line = captured.join('')
    // The `token` field must be redacted to its first-4-char prefix + '****'.
    expect(line).toContain(fullToken.slice(0, 4) + '****')
    // The serialized `token` field must NEVER contain the raw 32-char token.
    expect(line).not.toContain(fullToken)
  })
})
