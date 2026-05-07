/**
 * lib/post-status.ts — Status enum + chip variant + translation key (D-09)
 *
 * Per CAL-02: `failed` posts surface in the "needs review" section as if
 * they were `pending_review` — they need human attention.
 *
 * Status labels resolve via `next-intl` keys (`status.*`) so EN/TH render
 * naturally. `labelKey` is a path under the `status` namespace; callers
 * do `t(`status.${labelKey}`)` to render the localized label.
 */

export type PostStatus =
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'needs_team'
  | 'published'
  | 'failed'

export type ChipVariant = 'pending' | 'approved' | 'needs-team' | 'published'

export type StatusLabelKey = 'pending' | 'approved' | 'needsTeam' | 'published'

export interface StatusChip {
  variant: ChipVariant
  labelKey: StatusLabelKey
}

export function getStatusChip(s: PostStatus): StatusChip {
  switch (s) {
    case 'pending_review':
    case 'failed':
      return { variant: 'pending', labelKey: 'pending' }
    case 'approved':
    case 'scheduled':
      return { variant: 'approved', labelKey: 'approved' }
    case 'needs_team':
      return { variant: 'needs-team', labelKey: 'needsTeam' }
    case 'published':
      return { variant: 'published', labelKey: 'published' }
  }
}

const NEEDS_REVIEW: ReadonlySet<PostStatus> = new Set([
  'pending_review',
  'needs_team',
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
