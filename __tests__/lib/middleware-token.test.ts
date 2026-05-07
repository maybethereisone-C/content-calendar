import { describe, it, expect } from 'vitest'
import { extractTokenFromPath } from '../../lib/middleware-token'

const VALID = 'AbCdEfGhIjKlMnOpQrStUvWxYz123456' // 32 chars, URL-safe alphabet
expect(VALID.length).toBe(32) // sanity

describe('extractTokenFromPath', () => {
  it.each([
    [`/c/${VALID}/calendar`, VALID],
    [`/api/c/${VALID}/post/123/approve`, VALID],
    [`/c/${VALID}/post/abc`, VALID],
    [`/c/${VALID}/`, VALID],
    [`/c/${VALID}`, VALID],
  ])('extracts from %s', (path, expected) => {
    expect(extractTokenFromPath(path)).toBe(expected)
  })

  it.each([
    ['/c/garbage/calendar'],           // length 7
    ['/c//calendar'],                  // empty
    ['/c'],                            // no segment
    ['/c/'],                           // empty
    ['/healthz'],                      // not /c/
    ['/'],
    ['/api/c/short/test'],             // length 5
    ['/c/' + 'a'.repeat(31) + '/x'],  // length 31
    ['/c/' + 'a'.repeat(33) + '/x'],  // length 33
    ['/c/' + '!@#$' + 'a'.repeat(28) + '/x'], // 32 chars but invalid alphabet
    ['/c/' + ' '.repeat(32) + '/x'],  // 32 spaces — fail alphabet
  ])('returns null for %s', (path) => {
    expect(extractTokenFromPath(path)).toBe(null)
  })
})
