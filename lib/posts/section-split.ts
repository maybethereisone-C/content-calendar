/**
 * lib/posts/section-split.ts — Stable partition of calendar posts into sections.
 *
 * Used by `app/c/[token]/calendar/page.tsx` to render the two CAL-02 sections
 * (`ต้องตรวจ` / `อนุมัติแล้ว`) without re-querying. Generic over the row shape so
 * downstream callers can pass `CalendarPost`-like rows without an extra map step.
 */

import {
  isApproved,
  isNeedsReview,
  type PostStatus,
} from '@/lib/post-status'

export function splitSections<T extends { status: PostStatus }>(
  posts: readonly T[],
): { needsReview: T[]; approved: T[] } {
  const needsReview: T[] = []
  const approved: T[] = []
  for (const p of posts) {
    if (isNeedsReview(p.status)) needsReview.push(p)
    else if (isApproved(p.status)) approved.push(p)
  }
  return { needsReview, approved }
}
