/**
 * lib/buffer/types.ts — BufferClient interface + DTOs (D-02)
 *
 * Phase 3 will swap `mock` for `real` (Buffer GraphQL `createPost` mutation).
 * The interface shape lives here so Phase 2 can import from `@/lib/buffer`
 * without depending on either implementation.
 *
 * See `references/buffer-mcp.md` for the GraphQL surface that `real.ts` targets.
 */

/** A Buffer "channel" = one connected social account (per-org). */
export interface BufferChannel {
  id: string
  /** Buffer's platform identifier ("instagram" | "facebook" | "tiktok" | "x"). */
  service: 'instagram' | 'facebook' | 'tiktok' | 'x' | 'line'
  name: string
}

export interface CreatePostInput {
  /** Buffer org/account scope. From `clients.buffer_org_id`. */
  orgId: string
  /** Channel IDs (Buffer-side), 1+. Validated by Buffer; mock just echoes. */
  channelIds: string[]
  /** Caption text (Thai, may include emoji). */
  text: string
  /** Public HTTPS URLs of the post media. Buffer fetches these to attach. */
  mediaUrls: string[]
  /** UTC ISO scheduled time. */
  scheduledFor: string
}

export interface CreatePostResult {
  /** Per-channel post id, keyed by Buffer channel id. */
  postIdsByChannel: Record<string, string>
}

export interface BufferClient {
  /** Schedule a post across N channels. Phase 3 implements `real`. */
  createPost(input: CreatePostInput): Promise<CreatePostResult>
  /** List channels for an org (used for admin reconciliation; not Phase 2). */
  getOrgChannels(orgId: string): Promise<BufferChannel[]>
}
