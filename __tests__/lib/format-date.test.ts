/**
 * lib/format-date.test.ts — Bangkok-tz formatter tests (Plan 02-01 T2, D-01)
 *
 * Critical guards:
 *  - Buddhist-calendar override (Pitfall 12): year must be 2026, NOT 2569.
 *  - Latin numerals in DATE_TIME (so 10:00 is Arabic numerals, not Thai).
 *  - Bangkok = UTC+7 fixed (no DST), so the boundary math is straightforward.
 */
import { describe, it, expect } from 'vitest'
import {
  formatBangkokDate,
  formatBangkokDateTime,
  getBangkokMonthBounds,
} from '@/lib/format-date'

describe('formatBangkokDate', () => {
  it('formats 2026-05-07T03:00:00Z as "7 พ.ค. 2026" (NOT 2569)', () => {
    // 2026-05-07 03:00 UTC + 7h = 10:00 Bangkok same day
    const out = formatBangkokDate(new Date('2026-05-07T03:00:00Z'))
    expect(out).toBe('7 พ.ค. 2026')
    expect(out).not.toMatch(/2569/)
  })

  it('crosses year boundary: 2026-12-31T16:00:00Z → "1 ม.ค. 2027"', () => {
    // 2026-12-31 16:00 UTC + 7h = 2026-12-31 23:00 Bangkok
    // 2026-12-31 17:00 UTC + 7h = 2027-01-01 00:00 Bangkok — use 17:00:00Z to ensure crossing
    const out = formatBangkokDate(new Date('2026-12-31T17:00:00Z'))
    expect(out).toBe('1 ม.ค. 2027')
  })

  it('accepts ISO string input', () => {
    const out = formatBangkokDate('2026-05-07T03:00:00Z')
    expect(out).toBe('7 พ.ค. 2026')
  })
})

describe('formatBangkokDateTime', () => {
  it('formats 2026-05-07T03:00:00Z as "7 พ.ค. 2026 10:00" (Latin digits, 24h)', () => {
    const out = formatBangkokDateTime(new Date('2026-05-07T03:00:00Z'))
    // Tolerate single Unicode space variant in Intl output (some ICU versions
    // emit U+202F narrow nbsp before time). Normalize then assert.
    const normalized = out.replace(/\s+/g, ' ')
    expect(normalized).toBe('7 พ.ค. 2026 10:00')
    expect(normalized).not.toMatch(/2569/)
  })
})

describe('getBangkokMonthBounds', () => {
  it('returns Bangkok-month UTC bounds for May 2026', () => {
    const bounds = getBangkokMonthBounds(new Date('2026-05-15T12:00:00Z'))
    // May 1 00:00 Bangkok = Apr 30 17:00 UTC
    // Jun 1 00:00 Bangkok = May 31 17:00 UTC
    expect(bounds.startUtc).toBe('2026-04-30T17:00:00.000Z')
    expect(bounds.endUtc).toBe('2026-05-31T17:00:00.000Z')
  })

  it('handles a date AT Bangkok-month boundary (UTC 16:30 of last day) correctly', () => {
    // 2026-05-31 16:30 UTC = 2026-05-31 23:30 Bangkok — still May in Bangkok
    const bounds = getBangkokMonthBounds(new Date('2026-05-31T16:30:00Z'))
    expect(bounds.startUtc).toBe('2026-04-30T17:00:00.000Z')
    expect(bounds.endUtc).toBe('2026-05-31T17:00:00.000Z')
  })

  it('crosses to next month at 17:00 UTC of last day (= 00:00 Bangkok of new month)', () => {
    // 2026-05-31 17:00 UTC = 2026-06-01 00:00 Bangkok — June in Bangkok
    const bounds = getBangkokMonthBounds(new Date('2026-05-31T17:00:00Z'))
    expect(bounds.startUtc).toBe('2026-05-31T17:00:00.000Z')
    expect(bounds.endUtc).toBe('2026-06-30T17:00:00.000Z')
  })
})
