/**
 * lib/buffer/mock.ts — Mock Buffer client (Phase 2 default)
 *
 * Returns canned success responses; logs entry/exit via lib/logger so the
 * audit trail still records that "Phase 3 would have called Buffer here".
 * Phase 1's production-mock-refusal guard (`lib/env.ts`) ensures this file
 * never runs in prod when `BUFFER_CLIENT=mock` is set explicitly.
 */

import { logger } from '@/lib/logger'
import type {
  BufferChannel,
  BufferClient,
  CreatePostInput,
  CreatePostResult,
} from './types'

export class MockBufferClient implements BufferClient {
  async createPost(input: CreatePostInput): Promise<CreatePostResult> {
    logger.info(
      {
        msg: 'buffer_mock_create_post',
        orgId: input.orgId,
        channelIds: input.channelIds,
        textLen: input.text.length,
        mediaCount: input.mediaUrls.length,
        scheduledFor: input.scheduledFor,
      },
      'mock createPost',
    )
    const postIdsByChannel: Record<string, string> = {}
    for (const cid of input.channelIds) {
      postIdsByChannel[cid] = `mock_${cid}_${Date.now()}`
    }
    return { postIdsByChannel }
  }

  async getOrgChannels(orgId: string): Promise<BufferChannel[]> {
    logger.info(
      { msg: 'buffer_mock_get_org_channels', orgId },
      'mock getOrgChannels',
    )
    return []
  }
}
