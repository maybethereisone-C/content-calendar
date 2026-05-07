/**
 * lib/buffer/index.ts — BufferClient boot loader (D-02)
 *
 * Phase 2 RESOLUTION (per 02-RESEARCH.md Open Questions Q2, 2026-05-07):
 *   When `env.BUFFER_CLIENT` is `undefined` (production .env for Phase 2 leaves
 *   it UNSET), default to mock. The Phase 1 production-mock-refusal guard in
 *   `lib/env.ts` only fires when an EXPLICIT `mock` value is set in production
 *   — so leaving the var unset is the SAFE Phase 2 default. Phase 3 will set
 *   `BUFFER_CLIENT=real` once the real client lands.
 *
 * App code imports `getBufferClient()` from this module — never imports
 * `./mock` or `./real` directly (ESLint `no-restricted-imports` enforces).
 */

import { env } from '@/lib/env'
import type { BufferClient } from './types'
import { MockBufferClient } from './mock'
import { RealBufferClient } from './real'

let _instance: BufferClient | null = null

export function getBufferClient(): BufferClient {
  if (_instance) return _instance
  _instance = env.BUFFER_CLIENT === 'real'
    ? new RealBufferClient()
    : new MockBufferClient()
  return _instance
}

export type {
  BufferClient,
  BufferChannel,
  CreatePostInput,
  CreatePostResult,
} from './types'
