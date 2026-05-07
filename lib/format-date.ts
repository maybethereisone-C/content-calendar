/**
 * lib/format-date.ts — Bangkok-timezone date formatters, locale-aware (D-01).
 *
 * Native `Intl.DateTimeFormat`. Two locales supported:
 *   - 'th' → Thai labels with the gregorian-calendar override so the year
 *     renders as 2026, not 2569 Buddhist Era.
 *   - 'en' → English labels with `en-GB` (day-month-year order matches the
 *     Thai layout — `7 May 2026` reads cleanly in either language).
 *
 * Asia/Bangkok is fixed UTC+7 with no DST — boundary math is straightforward.
 */

export type DateLocale = 'en' | 'th'

const FORMATTERS = {
  date: {
    en: new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    }),
    th: new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    }),
  },
  dateTime: {
    en: new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Bangkok',
    }),
    th: new Intl.DateTimeFormat('th-TH-u-ca-gregory-nu-latn', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Bangkok',
    }),
  },
} as const

/** Card date stamp (CAL-02). EN: `7 May 2026`. TH: `7 พ.ค. 2026`. */
export function formatBangkokDate(
  d: Date | string,
  locale: DateLocale = 'en',
): string {
  return FORMATTERS.date[locale].format(new Date(d))
}

/** Post detail scheduled time (POST-01). EN: `7 May 2026, 10:00`. TH: `7 พ.ค. 2026 10:00`. */
export function formatBangkokDateTime(
  d: Date | string,
  locale: DateLocale = 'en',
): string {
  return FORMATTERS.dateTime[locale].format(new Date(d))
}

/**
 * Compute the UTC range that corresponds to "this month in Bangkok".
 * Used by `fetchCalendarPosts` to scope `scheduled_for >= start AND < end`.
 */
export function getBangkokMonthBounds(now: Date): {
  startUtc: string
  endUtc: string
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Bangkok',
  })
  const parts = Object.fromEntries(
    fmt
      .formatToParts(now)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  )
  const y = Number(parts.year)
  const m = Number(parts.month)
  // Bangkok = UTC+7 (no DST). 00:00 Bangkok on day 1 = 17:00 UTC on day 0.
  const startUtc = new Date(Date.UTC(y, m - 1, 1, -7, 0, 0)).toISOString()
  const endUtc = new Date(Date.UTC(y, m, 1, -7, 0, 0)).toISOString()
  return { startUtc, endUtc }
}
