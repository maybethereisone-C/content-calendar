/**
 * lib/post-status.ts — Status enum + chip variant + Thai label mapping (D-09)
 *
 * Per CAL-02: `failed` posts are surfaced in the "ต้องตรวจ" section as if
 * they were `pending_review` — they need human attention. Buffer's actual
 * failure detail lives in `events.payload`.
 *
 * Thai labels are byte-locked per SPEC + roadmap (รอตรวจ / อนุมัติแล้ว / รอทิว
 * / โพสต์แล้ว) — do not paraphrase.
 */

export type PostStatus =
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'needs_tew'
  | 'published'
  | 'failed'

export type ChipVariant = 'pending' | 'approved' | 'needs-tew' | 'published'

export interface StatusChip {
  variant: ChipVariant
  labelTh: string
}

export function getStatusChip(s: PostStatus): StatusChip {
  switch (s) {
    case 'pending_review':
    case 'failed':
      return { variant: 'pending', labelTh: 'รอตรวจ' }
    case 'approved':
    case 'scheduled':
      return { variant: 'approved', labelTh: 'อนุมัติแล้ว' }
    case 'needs_tew':
      return { variant: 'needs-tew', labelTh: 'รอทิว' }
    case 'published':
      return { variant: 'published', labelTh: 'โพสต์แล้ว' }
  }
}

const NEEDS_REVIEW: ReadonlySet<PostStatus> = new Set([
  'pending_review',
  'needs_tew',
  'failed',
])

const APPROVED: ReadonlySet<PostStatus> = new Set([
  'approved',
  'scheduled',
  'published',
])

export function isNeedsReview(s: PostStatus): boolean {
  return NEEDS_REVIEW.has(s)
}

export function isApproved(s: PostStatus): boolean {
  return APPROVED.has(s)
}
