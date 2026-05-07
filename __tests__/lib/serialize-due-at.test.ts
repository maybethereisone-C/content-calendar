import { describe, it, expect } from 'vitest'
import { serializeDueAt } from '@/lib/serialize-due-at'

describe('serializeDueAt (Pitfall 2 prevention)', () => {
  it('returns Z-suffix for UTC input', () => {
    expect(serializeDueAt('2026-05-16T03:00:00.000Z')).toBe('2026-05-16T03:00:00.000Z')
  })

  it('converts +07:00 Bangkok time to UTC Z-suffix', () => {
    expect(serializeDueAt('2026-05-16T10:00:00+07:00')).toBe('2026-05-16T03:00:00.000Z')
  })

  it('always returns a string ending in Z', () => {
    const samples = [
      '2026-01-01T00:00:00Z',
      '2026-12-31T23:59:59+07:00',
      '2026-06-15T12:00:00-05:00',
    ]
    for (const s of samples) {
      expect(serializeDueAt(s).endsWith('Z')).toBe(true)
    }
  })

  it('throws TypeError on invalid input (empty string)', () => {
    expect(() => serializeDueAt('')).toThrow()
  })

  it('throws TypeError on invalid input (non-date string)', () => {
    expect(() => serializeDueAt('not-a-date')).toThrow()
  })
})
