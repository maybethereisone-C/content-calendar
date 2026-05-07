/**
 * lib/posts/section-split.test.ts — Stable partition of posts into sections.
 */
import { describe, it, expect } from 'vitest'
import { splitSections } from '@/lib/posts/section-split'
import type { PostStatus } from '@/lib/post-status'

type Row = { id: string; status: PostStatus }

describe('splitSections', () => {
  it('empty input → both arrays empty', () => {
    expect(splitSections([])).toEqual({ needsReview: [], approved: [] })
  })

  it('partitions a mixed list correctly', () => {
    const rows: Row[] = [
      { id: 'a', status: 'pending_review' },
      { id: 'b', status: 'scheduled' },
      { id: 'c', status: 'needs_team' },
      { id: 'd', status: 'published' },
      { id: 'e', status: 'failed' },
    ]
    const out = splitSections(rows)
    expect(out.needsReview.map((r) => r.id)).toEqual(['a', 'c', 'e'])
    expect(out.approved.map((r) => r.id)).toEqual(['b', 'd'])
  })

  it('preserves input order within each section (stable partition)', () => {
    const rows: Row[] = [
      { id: '1', status: 'approved' },
      { id: '2', status: 'pending_review' },
      { id: '3', status: 'scheduled' },
      { id: '4', status: 'failed' },
      { id: '5', status: 'published' },
      { id: '6', status: 'needs_team' },
    ]
    const out = splitSections(rows)
    expect(out.needsReview.map((r) => r.id)).toEqual(['2', '4', '6'])
    expect(out.approved.map((r) => r.id)).toEqual(['1', '3', '5'])
  })

  it('handles all-approved input', () => {
    const rows: Row[] = [
      { id: 'a', status: 'scheduled' },
      { id: 'b', status: 'published' },
    ]
    const out = splitSections(rows)
    expect(out.needsReview).toEqual([])
    expect(out.approved.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('handles all-needs-review input', () => {
    const rows: Row[] = [
      { id: 'a', status: 'pending_review' },
      { id: 'b', status: 'failed' },
      { id: 'c', status: 'needs_team' },
    ]
    const out = splitSections(rows)
    expect(out.needsReview.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(out.approved).toEqual([])
  })
})
