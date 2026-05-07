/**
 * lib/buffer/real.ts — Real Buffer client STUB (Phase 3 implements)
 *
 * IMPORTANT: This file is restricted by ESLint `no-restricted-imports` —
 * only `@/lib/buffer/index.ts` may import it. App code imports from
 * `@/lib/buffer` (the index module), which selects mock/real at boot.
 *
 * Phase 3 will replace these throws with native `fetch` calls to
 * `https://api.buffer.com/graphql` per references/buffer-mcp.md.
 */

import type {
  BufferChannel,
  BufferClient,
  CreatePostInput,
  CreatePostResult,
} from './types'

export class RealBufferClient implements BufferClient {
  async createPost(_input: CreatePostInput): Promise<CreatePostResult> {
    throw new Error('NOT_IMPLEMENTED_PHASE_3')
  }

  async getOrgChannels(_orgId: string): Promise<BufferChannel[]> {
    throw new Error('NOT_IMPLEMENTED_PHASE_3')
  }
}
