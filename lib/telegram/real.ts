/**
 * lib/telegram/real.ts — Real Telegram client STUB (Phase 4 implements)
 *
 * IMPORTANT: This file is restricted by ESLint `no-restricted-imports` —
 * only `@/lib/telegram/index.ts` may import it. App code imports from
 * `@/lib/telegram` (the index module).
 *
 * Phase 4 will replace these throws with grammy `bot.api.sendMessage(...)` /
 * `bot.api.sendMediaGroup(...)` calls per references/STACK.md Q6.
 */

import type {
  SendMessageInput,
  SendPhotoMediaGroupInput,
  TelegramClient,
} from './types'

export class RealTelegramClient implements TelegramClient {
  async sendMessage(_input: SendMessageInput): Promise<void> {
    throw new Error('NOT_IMPLEMENTED_PHASE_4')
  }

  async sendPhotoMediaGroup(_input: SendPhotoMediaGroupInput): Promise<void> {
    throw new Error('NOT_IMPLEMENTED_PHASE_4')
  }
}
