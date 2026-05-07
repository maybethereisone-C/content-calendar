/**
 * lib/telegram/types.ts — TelegramClient interface + DTOs (D-03)
 *
 * Phase 4 will swap `mock` for `real` (grammy-based bot calls). Phase 2 only
 * needs the typed interface so other modules can import without depending on
 * either implementation.
 */

export interface SendMessageInput {
  /** Chat ID (forum supergroup) — usually env.TELEGRAM_GROUP_CHAT_ID. */
  chatId: string | number
  /** Forum thread (topic) id — one per client (`clients.telegram_thread_id`). */
  threadId?: number | null
  text: string
  /** Optional Markdown / HTML parse mode (Phase 4 chooses). */
  parseMode?: 'HTML' | 'MarkdownV2'
}

export interface PhotoMediaItem {
  /** Public HTTPS URL fetchable by Telegram's CDN. */
  url: string
  /** Optional caption attached to this specific photo. */
  caption?: string
}

export interface SendPhotoMediaGroupInput {
  chatId: string | number
  threadId?: number | null
  photos: PhotoMediaItem[]
  /**
   * Optional caption attached to the FIRST photo in the group (Telegram quirk:
   * `sendMediaGroup` only honors caption on the first item).
   */
  caption?: string
}

export interface TelegramClient {
  sendMessage(input: SendMessageInput): Promise<void>
  sendPhotoMediaGroup(input: SendPhotoMediaGroupInput): Promise<void>
}
