/**
 * lib/post-status.test.ts — Status → chip variant + i18n key mapping.
 */
import { describe, it, expect } from 'vitest'
import {
  getStatusChip,
  isNeedsReview,
  isApproved,
} from '@/lib/post-status'

describe('getStatusChip', () => {
  it('pending_review → variant=pending, labelKey=pending', () => {
    expect(getStatusChip('pending_review')).toEqual({
      variant: 'pending',
      labelKey: 'pending',
    })
  })

  it('failed → variant=pending, labelKey=pending (treated as needs-attention per CAL-02)', () => {
    expect(getStatusChip('failed')).toEqual({
      variant: 'pending',
      labelKey: 'pending',
    })
  })

  it('approved + scheduled → variant=approved, labelKey=approved', () => {
    expect(getStatusChip('approved')).toEqual({
      variant: 'approved',
      labelKey: 'approved',
    })
    expect(getStatusChip('scheduled')).toEqual({
      variant: 'approved',
      labelKey: 'approved',
    })
  })

  it('needs_team → variant=needs-team, labelKey=needsTeam', () => {
    expect(getStatusChip('needs_team')).toEqual({
      variant: 'needs-team',
      labelKey: 'needsTeam',
    })
  })

  it('published → variant=published, labelKey=published', () => {
    expect(getStatusChip('published')).toEqual({
      variant: 'published',
      labelKey: 'published',
    })
  })
})

describe('isNeedsReview / isApproved (section split helpers)', () => {
  it('isNeedsReview: pending_review + needs_team + failed → true', () => {
    expect(isNeedsReview('pending_review')).toBe(true)
    expect(isNeedsReview('needs_team')).toBe(true)
    expect(isNeedsReview('failed')).toBe(true)
  })

  it('isNeedsReview: approved + scheduled + published → false', () => {
    expect(isNeedsReview('approved')).toBe(false)
    expect(isNeedsReview('scheduled')).toBe(false)
    expect(isNeedsReview('published')).toBe(false)
  })

  it('isApproved: approved + scheduled + published → true', () => {
    expect(isApproved('approved')).toBe(true)
    expect(isApproved('scheduled')).toBe(true)
    expect(isApproved('published')).toBe(true)
  })

  it('isApproved: pending_review + needs_team + failed → false', () => {
    expect(isApproved('pending_review')).toBe(false)
    expect(isApproved('needs_team')).toBe(false)
    expect(isApproved('failed')).toBe(false)
  })
})
