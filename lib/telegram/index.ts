/**
 * lib/telegram/index.ts — TelegramClient boot loader (D-03)
 *
 * Phase 2 RESOLUTION (per 02-RESEARCH.md Open Questions Q2, 2026-05-07):
 *   When `env.TELEGRAM_CLIENT` is `undefined` (production .env for Phase 2
 *   leaves it UNSET), default to mock. The Phase 1 production-mock-refusal
 *   guard in `lib/env.ts` only fires when an EXPLICIT `mock` value is set in
 *   production — so leaving the var unset is the SAFE Phase 2 default. Phase
 *   4 will set `TELEGRAM_CLIENT=real` once the real grammy client lands.
 *
 * App code imports `getTelegramClient()` from this module — never imports
 * `./mock` or `./real` directly (ESLint `no-restricted-imports` enforces).
 */

import { env } from '@/lib/env'
import type { TelegramClient } from './types'
import { MockTelegramClient } from './mock'
import { RealTelegramClient } from './real'

let _instance: TelegramClient | null = null

export function getTelegramClient(): TelegramClient {
  if (_instance) return _instance
  _instance = env.TELEGRAM_CLIENT === 'real'
    ? new RealTelegramClient()
    : new MockTelegramClient()
  return _instance
}

export type {
  TelegramClient,
  SendMessageInput,
  SendPhotoMediaGroupInput,
  PhotoMediaItem,
} from './types'
