/**
 * lib/post-status.test.ts — Status → chip + Thai label mapping (Plan 02-01 T2, D-09).
 */
import { describe, it, expect } from 'vitest'
import {
  getStatusChip,
  isNeedsReview,
  isApproved,
} from '@/lib/post-status'

describe('getStatusChip', () => {
  it('pending_review → variant=pending, labelTh=รอตรวจ', () => {
    expect(getStatusChip('pending_review')).toEqual({
      variant: 'pending',
      labelTh: 'รอตรวจ',
    })
  })

  it('failed → variant=pending, labelTh=รอตรวจ (treated as needs-attention per CAL-02)', () => {
    expect(getStatusChip('failed')).toEqual({
      variant: 'pending',
      labelTh: 'รอตรวจ',
    })
  })

  it('approved + scheduled → variant=approved, labelTh=อนุมัติแล้ว', () => {
    expect(getStatusChip('approved')).toEqual({
      variant: 'approved',
      labelTh: 'อนุมัติแล้ว',
    })
    expect(getStatusChip('scheduled')).toEqual({
      variant: 'approved',
      labelTh: 'อนุมัติแล้ว',
    })
  })

  it('needs_tew → variant=needs-tew, labelTh=รอทิว', () => {
    expect(getStatusChip('needs_tew')).toEqual({
      variant: 'needs-tew',
      labelTh: 'รอทิว',
    })
  })

  it('published → variant=published, labelTh=โพสต์แล้ว', () => {
    expect(getStatusChip('published')).toEqual({
      variant: 'published',
      labelTh: 'โพสต์แล้ว',
    })
  })
})

describe('isNeedsReview / isApproved (section split helpers)', () => {
  it('isNeedsReview: pending_review + needs_tew + failed → true', () => {
    expect(isNeedsReview('pending_review')).toBe(true)
    expect(isNeedsReview('needs_tew')).toBe(true)
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

  it('isApproved: pending_review + needs_tew + failed → false', () => {
    expect(isApproved('pending_review')).toBe(false)
    expect(isApproved('needs_tew')).toBe(false)
    expect(isApproved('failed')).toBe(false)
  })
})
