import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// All required env var names
const REQUIRED_VARS = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'pub',
  SUPABASE_SECRET_KEY: 'secret',
  BUFFER_API_KEY: 'buf',
  TELEGRAM_BOT_TOKEN: 'tok',
  TELEGRAM_GROUP_CHAT_ID: '0',
  DASHBOARD_BASE_URL: 'http://localhost:3000',
}

function setAllRequired() {
  for (const [k, v] of Object.entries(REQUIRED_VARS)) {
    process.env[k] = v
  }
}

function clearAllEnv() {
  const allKeys = [
    ...Object.keys(REQUIRED_VARS),
    'BUFFER_CLIENT',
    'TELEGRAM_CLIENT',
    'NODE_ENV',
    'LOG_LEVEL',
    'TEST_TOKEN',
  ]
  for (const k of allKeys) {
    delete process.env[k]
  }
}

describe('lib/env validation', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as typeof process.exit)
    clearAllEnv()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    clearAllEnv()
  })

  // ── Missing required vars ──────────────────────────────────────────────

  it.each(Object.keys(REQUIRED_VARS))(
    'exits 1 when %s is missing',
    async (missingKey) => {
      setAllRequired()
      delete process.env[missingKey]
      await expect(import('@/lib/env')).rejects.toThrow('exit:1')
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`Missing required env:.*${missingKey}`))
      )
    }
  )

  it('exits 1 when BUFFER_API_KEY is empty string', async () => {
    setAllRequired()
    process.env.BUFFER_API_KEY = ''
    await expect(import('@/lib/env')).rejects.toThrow('exit:1')
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Missing required env:.*BUFFER_API_KEY/)
    )
  })

  it('exits 1 when NEXT_PUBLIC_SUPABASE_URL is not a valid URL', async () => {
    setAllRequired()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url'
    await expect(import('@/lib/env')).rejects.toThrow('exit:1')
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Missing required env:.*NEXT_PUBLIC_SUPABASE_URL/)
    )
  })

  // ── Mock-in-production refusal ──────────────────────────────────────────

  it('exits 1 when NODE_ENV=production and BUFFER_CLIENT=mock', async () => {
    setAllRequired()
    // NODE_ENV is typed as read-only in @types/node; cast via object assignment
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    process.env.BUFFER_CLIENT = 'mock'
    process.env.TELEGRAM_CLIENT = 'real'
    await expect(import('@/lib/env')).rejects.toThrow('exit:1')
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('mock client refused in production')
    )
  })

  it('exits 1 when NODE_ENV=production and TELEGRAM_CLIENT=mock', async () => {
    setAllRequired()
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    process.env.BUFFER_CLIENT = 'real'
    process.env.TELEGRAM_CLIENT = 'mock'
    await expect(import('@/lib/env')).rejects.toThrow('exit:1')
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('mock client refused in production')
    )
  })

  // ── Happy paths ─────────────────────────────────────────────────────────

  it('exports validated env when all required vars are present (dev)', async () => {
    setAllRequired()
    ;(process.env as Record<string, string>).NODE_ENV = 'development'
    const { env } = await import('@/lib/env')
    expect(env.SUPABASE_SECRET_KEY).toBe('secret')
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://x.supabase.co')
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('exports env when all required present + BUFFER_CLIENT=mock + NODE_ENV=development', async () => {
    setAllRequired()
    ;(process.env as Record<string, string>).NODE_ENV = 'development'
    process.env.BUFFER_CLIENT = 'mock'
    const { env } = await import('@/lib/env')
    expect(env.BUFFER_CLIENT).toBe('mock')
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('exports env when NODE_ENV=production + BUFFER_CLIENT=real + TELEGRAM_CLIENT=real', async () => {
    setAllRequired()
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    process.env.BUFFER_CLIENT = 'real'
    process.env.TELEGRAM_CLIENT = 'real'
    const { env } = await import('@/lib/env')
    expect(env.NODE_ENV).toBe('production')
    expect(exitSpy).not.toHaveBeenCalled()
  })
})
