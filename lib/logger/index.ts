/**
 * lib/logger/index.ts — Structured pino logger (LOG-02)
 *
 * Token redaction: the `token` field is always serialized to its 4-char
 * prefix + '****'. The full token MUST NEVER appear in any log line.
 * Use `token_prefix` (explicit field) when you want to log exactly 4 chars
 * for correlation — that field is NOT subject to serialization.
 *
 * Dev: pino-pretty (human-readable, colorized)
 * Prod: raw JSON to stdout (PM2 captures /var/log/dashboard/out.log)
 *
 * IMPORTANT: pino-pretty's transport spawns a worker thread — NOT compatible
 * with Next.js Edge runtime. This module MUST NOT be imported from Edge
 * runtime code. Middleware (plan 03) uses `export const runtime = 'nodejs'`
 * so pino works there without issue.
 */
import pino from 'pino'
import { env } from '@/lib/env'

const isDev =
  env.NODE_ENV === 'development' || env.NODE_ENV === undefined

export const logger = pino({
  level: env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  serializers: {
    /**
     * LOG-02: redact the full token to a 4-char prefix.
     * Returns undefined for empty/falsy tokens so pino omits the field.
     */
    token: (t: string) => (t ? t.slice(0, 4) + '****' : undefined),
  },
  // pino-pretty in dev; raw JSON in production.
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, ignore: 'pid,hostname' },
      }
    : undefined,
})
