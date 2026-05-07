/**
 * lib/format-date.ts — Bangkok-timezone date formatters (D-01)
 *
 * Native `Intl.DateTimeFormat` only — no `date-fns-tz`/`dayjs`/`moment-timezone`.
 *
 * Calendar override: `'th-TH-u-ca-gregory'` forces Gregorian year 2026 instead
 * of the Thai Buddhist default of 2569. Numbering override `-nu-latn` keeps
 * digits Latin so the time portion (`10:00`) renders as Arabic numerals, matching
 * the UI-SPEC.
 *
 * Asia/Bangkok is fixed UTC+7 with no DST — boundary math is straightforward.
 */

const SHORT_DATE = new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Bangkok',
})

const DATE_TIME = new Intl.DateTimeFormat('th-TH-u-ca-gregory-nu-latn', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Bangkok',
})

/** Card date stamp (CAL-02). Returns e.g. `"7 พ.ค. 2026"`. */
export function formatBangkokDate(d: Date | string): string {
  return SHORT_DATE.format(new Date(d))
}

/** Post detail scheduled time (POST-01). Returns e.g. `"7 พ.ค. 2026 10:00"`. */
export function formatBangkokDateTime(d: Date | string): string {
  return DATE_TIME.format(new Date(d))
}

/**
 * Compute the UTC range that corresponds to "this month in Bangkok".
 * Used by `fetchCalendarPosts` to scope `scheduled_for >= start AND < end`.
 *
 * Returns ISO strings (`Date.toISOString()` format) for direct Supabase use.
 */
export function getBangkokMonthBounds(now: Date): {
  startUtc: string
  endUtc: string
} {
  // Format `now` in Bangkok to extract the local month/year, then compute
  // the UTC instant that corresponds to 00:00 Bangkok on the 1st.
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
