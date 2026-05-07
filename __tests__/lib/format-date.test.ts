/**
 * lib/format-date.test.ts — Bangkok-tz formatter tests, locale-aware (D-01).
 *
 * Critical guards:
 *  - Buddhist-calendar override (Pitfall 12): TH year must be 2026, NOT 2569.
 *  - Latin numerals in TH DATE_TIME (so 10:00 is Arabic numerals).
 *  - Bangkok = UTC+7 fixed (no DST), so the boundary math is straightforward.
 *  - EN uses `en-GB` short month, day-first ordering.
 */
import { describe, it, expect } from 'vitest'
import {
  formatBangkokDate,
  formatBangkokDateTime,
  getBangkokMonthBounds,
} from '@/lib/format-date'

describe('formatBangkokDate (TH)', () => {
  it('formats 2026-05-07T03:00:00Z as "7 พ.ค. 2026" (NOT 2569)', () => {
    const out = formatBangkokDate(new Date('2026-05-07T03:00:00Z'), 'th')
    expect(out).toBe('7 พ.ค. 2026')
    expect(out).not.toMatch(/2569/)
  })

  it('crosses year boundary: 2026-12-31T17:00:00Z → "1 ม.ค. 2027"', () => {
    const out = formatBangkokDate(new Date('2026-12-31T17:00:00Z'), 'th')
    expect(out).toBe('1 ม.ค. 2027')
  })

  it('accepts ISO string input', () => {
    const out = formatBangkokDate('2026-05-07T03:00:00Z', 'th')
    expect(out).toBe('7 พ.ค. 2026')
  })
})

describe('formatBangkokDate (EN)', () => {
  it('formats 2026-05-07T03:00:00Z as "7 May 2026"', () => {
    const out = formatBangkokDate(new Date('2026-05-07T03:00:00Z'), 'en')
    expect(out).toBe('7 May 2026')
  })

  it('crosses year boundary: 2026-12-31T17:00:00Z → "1 Jan 2027"', () => {
    const out = formatBangkokDate(new Date('2026-12-31T17:00:00Z'), 'en')
    expect(out).toBe('1 Jan 2027')
  })

  it('defaults to EN when locale is omitted', () => {
    const out = formatBangkokDate(new Date('2026-05-07T03:00:00Z'))
    expect(out).toBe('7 May 2026')
  })
})

describe('formatBangkokDateTime', () => {
  it('TH: 2026-05-07T03:00:00Z → "7 พ.ค. 2026 10:00" (Latin digits, 24h)', () => {
    const out = formatBangkokDateTime(new Date('2026-05-07T03:00:00Z'), 'th')
    // Tolerate single Unicode space variant in Intl output (some ICU versions
    // emit U+202F narrow nbsp before time). Normalize then assert.
    const normalized = out.replace(/\s+/g, ' ')
    expect(normalized).toBe('7 พ.ค. 2026 10:00')
    expect(normalized).not.toMatch(/2569/)
  })

  it('EN: 2026-05-07T03:00:00Z → "7 May 2026, 10:00" (24h)', () => {
    const out = formatBangkokDateTime(new Date('2026-05-07T03:00:00Z'), 'en')
    const normalized = out.replace(/\s+/g, ' ')
    expect(normalized).toBe('7 May 2026, 10:00')
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
    const bounds = getBangkokMonthBounds(new Date('2026-05-31T16:30:00Z'))
    expect(bounds.startUtc).toBe('2026-04-30T17:00:00.000Z')
    expect(bounds.endUtc).toBe('2026-05-31T17:00:00.000Z')
  })

  it('crosses to next month at 17:00 UTC of last day (= 00:00 Bangkok of new month)', () => {
    const bounds = getBangkokMonthBounds(new Date('2026-05-31T17:00:00Z'))
    expect(bounds.startUtc).toBe('2026-05-31T17:00:00.000Z')
    expect(bounds.endUtc).toBe('2026-06-30T17:00:00.000Z')
  })
})
