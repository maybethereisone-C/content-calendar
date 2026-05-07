/**
 * lib/env.ts — Startup environment validation (OPS-04, OPS-05)
 *
 * Validates all required env vars at module load using zod@3.
 * On any missing/invalid var: exits process with code 1 (stderr names the var).
 * On mock-in-production: exits process with code 1.
 *
 * Import this module from server-only code; never from Edge runtime.
 */
import { z } from 'zod'

const requiredString = z.string().min(1)

const schema = z.object({
  // Required — process exits 1 if any are missing or empty
  NEXT_PUBLIC_SUPABASE_URL: requiredString.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: requiredString,
  SUPABASE_SECRET_KEY: requiredString,
  BUFFER_API_KEY: requiredString,
  TELEGRAM_BOT_TOKEN: requiredString,
  TELEGRAM_GROUP_CHAT_ID: requiredString,
  DASHBOARD_BASE_URL: requiredString.url(),

  // Optional
  BUFFER_CLIENT: z.enum(['mock', 'real']).optional(),
  TELEGRAM_CLIENT: z.enum(['mock', 'real']).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  LOG_LEVEL: z
    .enum(['silent', 'error', 'warn', 'info', 'debug', 'trace'])
    .optional(),
  TEST_TOKEN: z.string().optional(),
})

function fail(msg: string): never {
  process.stderr.write(msg + '\n')
  process.exit(1)
}

function validateEnv() {
  const result = schema.safeParse(process.env)
  if (!result.success) {
    const missingNames = result.error.issues
      .map((i) => i.path.join('.'))
      .join(', ')
    fail(`Missing required env: ${missingNames}`)
  }

  const data = result.data

  // OPS-05: refuse to start with mock clients in production
  if (
    data.NODE_ENV === 'production' &&
    (data.BUFFER_CLIENT === 'mock' || data.TELEGRAM_CLIENT === 'mock')
  ) {
    fail('mock client refused in production')
  }

  return Object.freeze(data)
}

export const env = validateEnv()
