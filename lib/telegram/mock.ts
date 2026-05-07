/**
 * lib/telegram/mock.ts — Mock Telegram client (Phase 2 default)
 *
 * Logs entry to pino so the audit trail records "Phase 4 would have notified
 * Tew here". Phase 1's production-mock-refusal guard in `lib/env.ts` ensures
 * this file never runs in prod when `TELEGRAM_CLIENT=mock` is set explicitly.
 */

import { logger } from '@/lib/logger'
import type {
  SendMessageInput,
  SendPhotoMediaGroupInput,
  TelegramClient,
} from './types'

export class MockTelegramClient implements TelegramClient {
  async sendMessage(input: SendMessageInput): Promise<void> {
    logger.info(
      {
        msg: 'telegram_mock_send_message',
        chatId: input.chatId,
        threadId: input.threadId ?? null,
        textLen: input.text.length,
      },
      'mock sendMessage',
    )
  }

  async sendPhotoMediaGroup(input: SendPhotoMediaGroupInput): Promise<void> {
    logger.info(
      {
        msg: 'telegram_mock_send_photo_media_group',
        chatId: input.chatId,
        threadId: input.threadId ?? null,
        photoCount: input.photos.length,
        captionLen: (input.caption ?? '').length,
      },
      'mock sendPhotoMediaGroup',
    )
  }
}
