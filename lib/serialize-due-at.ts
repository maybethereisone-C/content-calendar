/**
 * lib/serialize-due-at.ts — Pitfall 2 prevention for Buffer scheduling
 *
 * Serializes a Postgres timestamptz string (or any Date-parseable input) to
 * an ISO-8601 string ending in 'Z' (UTC).
 *
 * Used by Phase 3 Buffer integration. Buffer's `dueAt` field MUST be
 * UTC-suffixed. Bangkok local strings without 'Z' silently misschedule
 * by 7 hours.
 *
 * @throws TypeError if input cannot be parsed as a valid date.
 */
export function serializeDueAt(input: string): string {
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`serializeDueAt: invalid input "${input}"`)
  }
  return d.toISOString()
}
