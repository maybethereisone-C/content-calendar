// @vitest-environment node
/**
 * removeAsset Server Action — soft-delete + Storage cleanup + events insert
 * (PHOTO-03, LOG-01, T-02-04-01..03).
 *
 * Mocks supabaseAdmin (.from + .storage) + next/headers + next/cache:
 *   - Happy path: client_added asset → soft-delete UPDATE returns 1 row →
 *     storage.remove succeeds → events row inserted → { ok: true }
 *   - Tew_prepared rejection: role='tew_prepared' → guarded UPDATE WHERE
 *     role='client_added' returns 0 rows → not_removable; ZERO storage; ZERO events
 *   - Cross-tenant: asset.client_id ≠ x-client-id → not_found; ZERO changes
 *   - Already-deleted: asset.deleted_at IS NOT NULL → not_found (asset fetch
 *     filters this out before the UPDATE — return matches no-leak shape)
 *   - Storage remove fails after DB soft-delete: still returns { ok: true };
 *     events row payload includes storage_remove_error
 *   - Missing x-client-id: unauthenticated
 *   - Schema validation: bad uuid → invalid_input
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ----- shared module state ------------------------------------------------

interface MockState {
  // Asset fetch (post_assets SELECT response)
  fetchResp: { data: unknown; error: unknown }
  // Soft-delete UPDATE response
  updateResp: { data: unknown; error: unknown }
  // Storage remove response
  storageResp: { data: unknown; error: unknown }
  // Events insert response
  eventInsertResp: { data: unknown; error: unknown }
  // captured arguments
  updateArgs: { deleted_at?: string } | null
  insertedEvent: Record<string, unknown> | null
  storageRemoveCalls: string[][]
  updateChain: { eqs: Array<[string, unknown]>; isCalls: Array<[string, unknown]> }
  headerOverride: Headers | null
}

const mockState: MockState = {
  fetchResp: { data: null, error: null },
  updateResp: { data: [], error: null },
  storageResp: { data: [{}], error: null },
  eventInsertResp: { data: { id: 'event-1' }, error: null },
  updateArgs: null,
  insertedEvent: null,
  storageRemoveCalls: [],
  updateChain: { eqs: [], isCalls: [] },
  headerOverride: null,
}

function resetMockState() {
  mockState.fetchResp = { data: null, error: null }
  mockState.updateResp = { data: [], error: null }
  mockState.storageResp = { data: [{}], error: null }
  mockState.eventInsertResp = { data: { id: 'event-1' }, error: null }
  mockState.updateArgs = null
  mockState.insertedEvent = null
  mockState.storageRemoveCalls = []
  mockState.updateChain = { eqs: [], isCalls: [] }
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
      if (table === 'post_assets') {
        return {
          // SELECT chain: from('post_assets').select(...).eq('id', x).eq('post_id', y).maybeSingle()
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => mockState.fetchResp),
              })),
            })),
          })),
          // UPDATE chain:
          //   from('post_assets').update({...}).eq('id', x).eq('client_id', y).eq('role', 'client_added').is('deleted_at', null).select('id')
          update: vi.fn((args: { deleted_at: string }) => {
            mockState.updateArgs = { deleted_at: args.deleted_at }
            const chain = {
              eq: vi.fn(function eqFn(field: string, val: unknown) {
                mockState.updateChain.eqs.push([field, val])
                return chain
              }),
              is: vi.fn((field: string, val: unknown) => {
                mockState.updateChain.isCalls.push([field, val])
                return {
                  select: vi.fn(async () => mockState.updateResp),
                }
              }),
            }
            return chain
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
    storage: {
      from: vi.fn((bucket: string) => {
        if (bucket !== 'post-media') {
          throw new Error(`unexpected bucket: ${bucket}`)
        }
        return {
          remove: vi.fn(async (paths: string[]) => {
            mockState.storageRemoveCalls.push(paths)
            return mockState.storageResp
          }),
        }
      }),
    },
  }
  return { supabaseAdmin }
})

// ----- helpers ------------------------------------------------------------

const VALID_POST_ID = '00000000-0000-0000-0000-000000000010'
const VALID_ASSET_ID = '00000000-0000-0000-0000-000000000020'

async function loadAction() {
  const mod = await import('@/app/c/[token]/post/[id]/actions')
  return mod.removeAsset
}

// ----- tests --------------------------------------------------------------

describe('removeAsset Server Action', () => {
  beforeEach(() => {
    resetMockState()
    vi.clearAllMocks()
  })

  it('happy path: client_added asset → soft-delete + storage remove + events row → { ok: true }', async () => {
    mockState.fetchResp = {
      data: {
        id: VALID_ASSET_ID,
        post_id: VALID_POST_ID,
        client_id: 'client-1',
        role: 'client_added',
        storage_path: 'client-1/post-x/img-1.jpg',
        deleted_at: null,
      },
      error: null,
    }
    mockState.updateResp = { data: [{ id: VALID_ASSET_ID }], error: null }

    const removeAsset = await loadAction()
    const res = await removeAsset({
      postId: VALID_POST_ID,
      assetId: VALID_ASSET_ID,
    })

    expect(res).toEqual({ ok: true })

    // soft-delete called with deleted_at timestamp (non-null)
    expect(mockState.updateArgs?.deleted_at).toBeTruthy()

    // Guards applied at SQL level
    expect(mockState.updateChain.eqs).toContainEqual(['id', VALID_ASSET_ID])
    expect(mockState.updateChain.eqs).toContainEqual(['client_id', 'client-1'])
    expect(mockState.updateChain.eqs).toContainEqual(['role', 'client_added'])
    expect(mockState.updateChain.isCalls).toContainEqual(['deleted_at', null])

    // Storage object removed
    expect(mockState.storageRemoveCalls).toEqual([
      ['client-1/post-x/img-1.jpg'],
    ])

    // Events row inserted with payload
    expect(mockState.insertedEvent).toMatchObject({
      client_id: 'client-1',
      post_id: VALID_POST_ID,
      type: 'photo_removed',
      payload: {
        asset_id: VALID_ASSET_ID,
        storage_path: 'client-1/post-x/img-1.jpg',
        role: 'client_added',
      },
    })
    // No storage_remove_error key when storage succeeds
    expect(
      (mockState.insertedEvent?.payload as Record<string, unknown>)
        ?.storage_remove_error,
    ).toBeUndefined()

    const { logger } = await import('@/lib/logger')
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'action_start',
        action: 'removeAsset',
      }),
    )
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'action_end',
        action: 'removeAsset',
        status: 200,
      }),
    )
  })

  it('tew_prepared rejection: role=tew_prepared → guarded UPDATE returns 0 rows → not_removable; ZERO storage + ZERO events', async () => {
    mockState.fetchResp = {
      data: {
        id: VALID_ASSET_ID,
        post_id: VALID_POST_ID,
        client_id: 'client-1',
        role: 'tew_prepared',
        storage_path: 'client-1/post-x/tew.jpg',
        deleted_at: null,
      },
      error: null,
    }
    mockState.updateResp = { data: [], error: null } // 0 rows: WHERE role='client_added' filters out

    const removeAsset = await loadAction()
    const res = await removeAsset({
      postId: VALID_POST_ID,
      assetId: VALID_ASSET_ID,
    })

    expect(res).toEqual({ ok: false, error: 'not_removable' })
    expect(mockState.storageRemoveCalls).toEqual([])
    expect(mockState.insertedEvent).toBeNull()

    const { logger } = await import('@/lib/logger')
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'action_end',
        action: 'removeAsset',
        status: 'rejected_not_removable',
      }),
    )
  })

  it('cross-tenant: asset.client_id ≠ x-client-id → not_found; ZERO update + ZERO storage + ZERO events', async () => {
    mockState.fetchResp = {
      data: {
        id: VALID_ASSET_ID,
        post_id: VALID_POST_ID,
        client_id: 'client-OTHER',
        role: 'client_added',
        storage_path: 'client-OTHER/post-x/img-1.jpg',
        deleted_at: null,
      },
      error: null,
    }

    const removeAsset = await loadAction()
    const res = await removeAsset({
      postId: VALID_POST_ID,
      assetId: VALID_ASSET_ID,
    })

    expect(res).toEqual({ ok: false, error: 'not_found' })
    expect(mockState.updateArgs).toBeNull()
    expect(mockState.storageRemoveCalls).toEqual([])
    expect(mockState.insertedEvent).toBeNull()

    const { logger } = await import('@/lib/logger')
    expect(logger.warn).toHaveBeenCalled()
  })

  it('already-deleted: asset.deleted_at non-null → not_found; ZERO update + ZERO storage + ZERO events', async () => {
    mockState.fetchResp = {
      data: {
        id: VALID_ASSET_ID,
        post_id: VALID_POST_ID,
        client_id: 'client-1',
        role: 'client_added',
        storage_path: 'client-1/post-x/img-1.jpg',
        deleted_at: '2026-05-08T00:00:00Z',
      },
      error: null,
    }

    const removeAsset = await loadAction()
    const res = await removeAsset({
      postId: VALID_POST_ID,
      assetId: VALID_ASSET_ID,
    })

    expect(res).toEqual({ ok: false, error: 'not_found' })
    expect(mockState.updateArgs).toBeNull()
    expect(mockState.storageRemoveCalls).toEqual([])
    expect(mockState.insertedEvent).toBeNull()
  })

  it('storage remove fails after DB soft-delete: still returns { ok: true } + events.payload.storage_remove_error set', async () => {
    mockState.fetchResp = {
      data: {
        id: VALID_ASSET_ID,
        post_id: VALID_POST_ID,
        client_id: 'client-1',
        role: 'client_added',
        storage_path: 'client-1/post-x/img-1.jpg',
        deleted_at: null,
      },
      error: null,
    }
    mockState.updateResp = { data: [{ id: VALID_ASSET_ID }], error: null }
    mockState.storageResp = {
      data: null,
      error: { message: 'bucket not found' },
    }

    const removeAsset = await loadAction()
    const res = await removeAsset({
      postId: VALID_POST_ID,
      assetId: VALID_ASSET_ID,
    })

    // DB is source of truth — soft-delete succeeded, action returns ok
    expect(res).toEqual({ ok: true })

    // Storage remove was attempted
    expect(mockState.storageRemoveCalls).toEqual([
      ['client-1/post-x/img-1.jpg'],
    ])

    // Events payload captures the storage failure for the janitor
    expect(mockState.insertedEvent?.payload).toMatchObject({
      asset_id: VALID_ASSET_ID,
      storage_path: 'client-1/post-x/img-1.jpg',
      role: 'client_added',
      storage_remove_error: 'bucket not found',
    })

    const { logger } = await import('@/lib/logger')
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'storage_remove_failed',
      }),
    )
  })

  it('missing x-client-id header → unauthenticated; ZERO changes', async () => {
    mockState.headerOverride = new Headers() // empty

    const removeAsset = await loadAction()
    const res = await removeAsset({
      postId: VALID_POST_ID,
      assetId: VALID_ASSET_ID,
    })

    expect(res).toEqual({ ok: false, error: 'unauthenticated' })
    expect(mockState.updateArgs).toBeNull()
    expect(mockState.storageRemoveCalls).toEqual([])
    expect(mockState.insertedEvent).toBeNull()
  })

  it('invalid uuid → invalid_input via zod', async () => {
    const removeAsset = await loadAction()
    const res = await removeAsset({
      postId: 'not-a-uuid',
      assetId: VALID_ASSET_ID,
    })

    expect(res).toEqual({ ok: false, error: 'invalid_input' })
    expect(mockState.updateArgs).toBeNull()
  })
})
