/**
 * lib/channel-limits.ts — Per-channel character limits + UI labels (D-11)
 *
 * Caption editor's <CharCounter> watches form state and renders one row per
 * destination channel of the current post (NOT all 4 always). Color thresholds
 * <90% / 90-100% / >100% live in the component, not here.
 */

export const CHANNEL_LIMITS = {
  instagram: 2200,
  facebook: 63206,
  tiktok: 4000,
  x: 280,
} as const

export type Channel = keyof typeof CHANNEL_LIMITS

export const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  x: 'X',
}

/** Render order for channel rows / badges, per UI-SPEC. */
export const CHANNEL_ORDER: Channel[] = ['instagram', 'facebook', 'tiktok', 'x']
