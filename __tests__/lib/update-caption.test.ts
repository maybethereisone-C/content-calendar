// @vitest-environment node
/**
 * updateCaption Server Action — guarded UPDATE + events insert (CAP-02, CAP-03, LOG-01).
 *
 * Mocks supabaseAdmin chain + next/headers + next/cache to verify:
 *   - Happy path: pending_review post → UPDATE succeeds → events row inserted
 *   - Race-loser: status not pending_review → 0 rows updated → not_editable
 *   - Cross-tenant: post.client_id ≠ x-client-id → not_found (no leak)
 *   - Missing x-client-id: unauthenticated
 *   - Missing post: not_found
 *   - Schema violation: invalid postId → invalid_input
 *   - DB error during fetch / UPDATE → db_error
 *
 * Uses module-level state for the mocked Supabase client so each test can
 * override responses for individual chain calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ----- shared module state ------------------------------------------------

interface MockState {
  fetchResp: { data: unknown; error: unknown } // posts SELECT response
  updateResp: { data: unknown; error: unknown } // posts UPDATE response
  eventInsertResp: { data: unknown; error: unknown }
  // captured arguments
  updateArgs: { caption: string | null } | null
  insertedEvent: Record<string, unknown> | null
  updateChain: { eqs: Array<[string, unknown]> }
  headerOverride: Headers | null
}

const mockState: MockState = {
  fetchResp: { data: null, error: null },
  updateResp: { data: [], error: null },
  eventInsertResp: { data: { id: 'event-1' }, error: null },
  updateArgs: null,
  insertedEvent: null,
  updateChain: { eqs: [] },
  headerOverride: null,
}

function resetMockState() {
  mockState.fetchResp = { data: null, error: null }
  mockState.updateResp = { data: [], error: null }
  mockState.eventInsertResp = { data: { id: 'event-1' }, error: null }
  mockState.updateArgs = null
  mockState.insertedEvent = null
  mockState.updateChain = { eqs: [] }
  mockState.headerOverride = null
}

// ----- mocks --------------------------------------------------------------

vi.mock('next/headers', () => ({
  headers: async () =>
    mockState.headerOverride ?? new Headers({ 'x-client-id': 'client-1' }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/supabase/server', () => {
  const supabaseAdmin = {
    from: vi.fn((table: string) => {
      if (table === 'posts') {
        return {
          // SELECT chain: from('posts').select(...).eq('id', x).maybeSingle()
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => mockState.fetchResp),
            })),
          })),
          // UPDATE chain: from('posts').update({...}).eq('id', x).eq('status', 'pending_review').select('id')
          update: vi.fn((args: { caption_th: string }) => {
            mockState.updateArgs = { caption: args.caption_th }
            return {
              eq: vi.fn(function eqFn(field: string, val: unknown) {
                mockState.updateChain.eqs.push([field, val])
                return {
                  eq: vi.fn((field2: string, val2: unknown) => {
                    mockState.updateChain.eqs.push([field2, val2])
                    return {
                      select: vi.fn(async () => mockState.updateResp),
                    }
                  }),
                }
              }),
            }
          }),
        }
      }
      if (table === 'events') {
        return {
          insert: vi.fn((row: Record<string, unknown>) => {
            mockState.insertedEvent = row
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => mockState.eventInsertResp),
              })),
            }
          }),
        }
      }
      throw new Error(`unexpected table in mock: ${table}`)
    }),
  }
  return { supabaseAdmin }
})

// ----- helpers ------------------------------------------------------------

const VALID_UUID = '00000000-0000-0000-0000-000000000010'

async function loadAction() {
  const mod = await import('@/app/c/[token]/post/[id]/actions')
  return mod.updateCaption
}

// ----- tests --------------------------------------------------------------

describe('updateCaption Server Action', () => {
  beforeEach(() => {
    resetMockState()
    vi.clearAllMocks()
  })

  it('happy path: pending_review post → UPDATE succeeds + events row inserted', async () => {
    mockState.fetchResp = {
      data: {
        caption_th: 'old caption',
        status: 'pending_review',
        client_id: 'client-1',
      },
      error: null,
    }
    mockState.updateResp = { data: [{ id: VALID_UUID }], error: null }

    const updateCaption = await loadAction()
    const res = await updateCaption({
      postId: VALID_UUID,
      newCaption: 'new caption',
    })

    expect(res).toEqual({ ok: true })
    // UPDATE called with new caption
    expect(mockState.updateArgs?.caption).toBe('new caption')
    // Status guard applied
    expect(mockState.updateChain.eqs).toContainEqual(['id', VALID_UUID])
    expect(mockState.updateChain.eqs).toContainEqual([
      'status',
      'pending_review',
    ])
    // Events row inserted with full diff payload
    expect(mockState.insertedEvent).toMatchObject({
      client_id: 'client-1',
      post_id: VALID_UUID,
      type: 'caption_edited',
      payload: {
        before: 'old caption',
        after: 'new caption',
        length_before: 11,
        length_after: 11,
      },
    })

    const { logger } = await import('@/lib/logger')
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'action_start',
        action: 'updateCaption',
      }),
    )
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'action_end',
        action: 'updateCaption',
        status: 200,
      }),
    )
  })

  it('race-loser: status=scheduled → guarded UPDATE returns 0 rows → not_editable, NO events', async () => {
    mockState.fetchResp = {
      data: {
        caption_th: 'caption',
        status: 'scheduled',
        client_id: 'client-1',
      },
      error: null,
    }
    mockState.updateResp = { data: [], error: null } // 0 rows updated

    const updateCaption = await loadAction()
    const res = await updateCaption({
      postId: VALID_UUID,
      newCaption: 'attempt',
    })

    expect(res).toEqual({ ok: false, error: 'not_editable' })
    expect(mockState.insertedEvent).toBeNull()

    const { logger } = await import('@/lib/logger')
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'action_end',
        action: 'updateCaption',
        status: 'rejected_not_pending',
      }),
    )
  })

  it('cross-tenant: post.client_id ≠ x-client-id → not_found, ZERO update + ZERO events', async () => {
    mockState.fetchResp = {
      data: {
        caption_th: 'caption',
        status: 'pending_review',
        client_id: 'client-OTHER',
      },
      error: null,
    }

    const updateCaption = await loadAction()
    const res = await updateCaption({
      postId: VALID_UUID,
      newCaption: 'attempt',
    })

    expect(res).toEqual({ ok: false, error: 'not_found' })
    expect(mockState.updateArgs).toBeNull()
    expect(mockState.insertedEvent).toBeNull()

    const { logger } = await import('@/lib/logger')
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'action_error',
        action: 'updateCaption',
        error: 'cross_tenant',
      }),
    )
  })

  it('missing x-client-id header → unauthenticated', async () => {
    mockState.headerOverride = new Headers() // empty

    const updateCaption = await loadAction()
    const res = await updateCaption({
      postId: VALID_UUID,
      newCaption: 'attempt',
    })

    expect(res).toEqual({ ok: false, error: 'unauthenticated' })
    expect(mockState.updateArgs).toBeNull()
    expect(mockState.insertedEvent).toBeNull()
  })

  it('missing post → not_found (no info leak)', async () => {
    mockState.fetchResp = { data: null, error: null }

    const updateCaption = await loadAction()
    const res = await updateCaption({
      postId: VALID_UUID,
      newCaption: 'attempt',
    })

    expect(res).toEqual({ ok: false, error: 'not_found' })
    expect(mockState.updateArgs).toBeNull()
    expect(mockState.insertedEvent).toBeNull()
  })

  it('invalid postId (not a uuid) → invalid_input via zod', async () => {
    const updateCaption = await loadAction()
    const res = await updateCaption({
      postId: 'not-a-uuid',
      newCaption: 'caption',
    })

    expect(res).toEqual({ ok: false, error: 'invalid_input' })
  })

  it('DB error during initial fetch → db_error + logger.error', async () => {
    mockState.fetchResp = {
      data: null,
      error: { message: 'connection refused' },
    }

    const updateCaption = await loadAction()
    const res = await updateCaption({
      postId: VALID_UUID,
      newCaption: 'attempt',
    })

    expect(res).toEqual({ ok: false, error: 'db_error' })

    const { logger } = await import('@/lib/logger')
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'action_error',
        action: 'updateCaption',
      }),
    )
  })

  it('DB error during UPDATE → db_error + logger.error', async () => {
    mockState.fetchResp = {
      data: {
        caption_th: 'old',
        status: 'pending_review',
        client_id: 'client-1',
      },
      error: null,
    }
    mockState.updateResp = {
      data: null,
      error: { message: 'deadlock detected' },
    }

    const updateCaption = await loadAction()
    const res = await updateCaption({
      postId: VALID_UUID,
      newCaption: 'attempt',
    })

    expect(res).toEqual({ ok: false, error: 'db_error' })
    expect(mockState.insertedEvent).toBeNull()
  })
})
