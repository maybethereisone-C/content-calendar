// @vitest-environment node
/**
 * POST /api/c/[token]/post/[id]/asset — multipart upload + Sharp pipeline
 * + Storage upload + post_assets insert + events insert (PHOTO-01..05, LOG-01).
 *
 * Mocks supabaseAdmin (.from + .storage), processPhoto, next/headers.
 * Uses native FormData + Blob to construct multipart bodies.
 *
 * Cases:
 *   1. Happy path — valid client + 5MB image → 200 + asset row; storage.upload
 *      called once; post_assets.insert called once; events.insert called once
 *      with type='photo_added'
 *   2. Content-Length > 25MB → 413 + Thai message; processPhoto NOT called
 *   3. Multipart file size > 25MB (Content-Length undefined or lying) → 413
 *   4. Missing x-client-id → 401 unauthenticated
 *   5. Cross-tenant (post.client_id !== x-client-id) → 404 not_found
 *   6. No file in formData → 400 no_file
 *   7. processPhoto throws → 500 process_failed; no storage upload; no DB writes
 *   8. Storage upload fails → 500 upload_failed; no DB writes
 *   9. post_assets insert fails AFTER storage upload → 500 db_error AND
 *      storage object cleaned up via storage.remove rollback
 *  10. HEIC input → events.payload includes input_mime='image/heic',
 *      aspect_ratio, original_size, output_size
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ----- shared module state ------------------------------------------------

interface MockState {
  // Post fetch (cross-tenant guard)
  postFetchResp: { data: unknown; error: unknown }
  // Sharp pipeline output
  processPhotoImpl: () => Promise<{
    jpegBuffer: Buffer
    width: number
    height: number
    aspectRatio: '1:1' | '4:5'
  }>
  // Storage upload response
  storageUploadResp: { data: unknown; error: unknown }
  // Storage remove (rollback) response
  storageRemoveResp: { data: unknown; error: unknown }
  // post_assets insert response
  assetInsertResp: { data: unknown; error: unknown }
  // events insert response
  eventInsertResp: { data: unknown; error: unknown }
  // captured args
  storageUploadCalls: Array<{ path: string; size: number; contentType: string }>
  storageRemoveCalls: string[][]
  insertedAsset: Record<string, unknown> | null
  insertedEvent: Record<string, unknown> | null
  processPhotoCalls: number
  headerOverride: Headers | null
}

const mockState: MockState = {
  postFetchResp: { data: null, error: null },
  processPhotoImpl: async () => ({
    jpegBuffer: Buffer.from('FAKEJPEG'),
    width: 1024,
    height: 1024,
    aspectRatio: '1:1',
  }),
  storageUploadResp: { data: { path: 'x' }, error: null },
  storageRemoveResp: { data: [{}], error: null },
  assetInsertResp: { data: null, error: null },
  eventInsertResp: { data: { id: 'event-1' }, error: null },
  storageUploadCalls: [],
  storageRemoveCalls: [],
  insertedAsset: null,
  insertedEvent: null,
  processPhotoCalls: 0,
  headerOverride: null,
}

function resetMockState() {
  mockState.postFetchResp = { data: null, error: null }
  mockState.processPhotoImpl = async () => ({
    jpegBuffer: Buffer.from('FAKEJPEG'),
    width: 1024,
    height: 1024,
    aspectRatio: '1:1',
  })
  mockState.storageUploadResp = { data: { path: 'x' }, error: null }
  mockState.storageRemoveResp = { data: [{}], error: null }
  mockState.assetInsertResp = { data: null, error: null }
  mockState.eventInsertResp = { data: { id: 'event-1' }, error: null }
  mockState.storageUploadCalls = []
  mockState.storageRemoveCalls = []
  mockState.insertedAsset = null
  mockState.insertedEvent = null
  mockState.processPhotoCalls = 0
  mockState.headerOverride = null
}

// ----- mocks --------------------------------------------------------------

vi.mock('next/headers', () => ({
  headers: async () =>
    mockState.headerOverride ??
    new Headers({ 'x-client-id': 'client-1', 'x-client-slug': 'thai-sea' }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/photo-pipeline/process', () => ({
  processPhoto: vi.fn(async (...args: unknown[]) => {
    void args
    mockState.processPhotoCalls += 1
    return mockState.processPhotoImpl()
  }),
}))

vi.mock('nanoid', () => ({
  nanoid: (n: number) => 'a'.repeat(n),
}))

vi.mock('@/lib/supabase/server', () => {
  const supabaseAdmin = {
    from: vi.fn((table: string) => {
      if (table === 'posts') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => mockState.postFetchResp),
            })),
          })),
        }
      }
      if (table === 'post_assets') {
        return {
          insert: vi.fn((row: Record<string, unknown>) => {
            mockState.insertedAsset = row
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => mockState.assetInsertResp),
              })),
            }
          }),
        }
      }
      if (table === 'events') {
        return {
          insert: vi.fn(async (row: Record<string, unknown>) => {
            mockState.insertedEvent = row
            return mockState.eventInsertResp
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    }),
    storage: {
      from: vi.fn((bucket: string) => {
        if (bucket !== 'post-media') {
          throw new Error(`unexpected bucket: ${bucket}`)
        }
        return {
          upload: vi.fn(
            async (
              path: string,
              body: Buffer,
              opts: { contentType: string },
            ) => {
              mockState.storageUploadCalls.push({
                path,
                size: body.length,
                contentType: opts.contentType,
              })
              return mockState.storageUploadResp
            },
          ),
          remove: vi.fn(async (paths: string[]) => {
            mockState.storageRemoveCalls.push(paths)
            return mockState.storageRemoveResp
          }),
          getPublicUrl: vi.fn((path: string) => ({
            data: {
              publicUrl: `https://test.supabase.co/storage/v1/object/public/post-media/${path}`,
            },
          })),
        }
      }),
    },
  }
  return { supabaseAdmin }
})

// ----- helpers ------------------------------------------------------------

const VALID_POST_ID = '00000000-0000-0000-0000-000000000010'
const TOKEN = 'token-xyz'

async function loadHandler() {
  const mod = await import('@/app/api/c/[token]/post/[id]/asset/route')
  return mod.POST
}

function makeRequest(opts: {
  body?: BodyInit | null
  contentLength?: number
  contentType?: string
}): Request {
  const headers: Record<string, string> = {}
  if (opts.contentType) headers['content-type'] = opts.contentType
  if (opts.contentLength !== undefined)
    headers['content-length'] = String(opts.contentLength)
  return new Request('http://localhost/api/c/' + TOKEN + '/post/' + VALID_POST_ID + '/asset', {
    method: 'POST',
    headers,
    body: opts.body ?? null,
  })
}

async function makeFormRequest(file: Blob): Promise<Request> {
  const fd = new FormData()
  fd.append('file', file)
  // Native FormData → Request encodes as multipart automatically.
  return new Request(
    'http://localhost/api/c/' + TOKEN + '/post/' + VALID_POST_ID + '/asset',
    {
      method: 'POST',
      body: fd,
    },
  )
}

const ctx = {
  params: Promise.resolve({ token: TOKEN, id: VALID_POST_ID }),
}

// ----- tests --------------------------------------------------------------

describe('POST /api/c/[token]/post/[id]/asset', () => {
  beforeEach(() => {
    resetMockState()
    vi.clearAllMocks()
  })

  it('1. happy path: valid client + image → 200 + asset row; one upload + one insert + one event', async () => {
    mockState.postFetchResp = {
      data: { id: VALID_POST_ID, client_id: 'client-1', status: 'pending_review' },
      error: null,
    }
    mockState.assetInsertResp = {
      data: {
        id: 'asset-1',
        storage_path: 'thai-sea/' + VALID_POST_ID + '/' + VALID_POST_ID + '-aaaaaaaaaa.jpg',
        role: 'client_added',
        sort_order: 999,
        aspect_ratio: '1:1',
      },
      error: null,
    }

    const file = new Blob([new Uint8Array(5 * 1024 * 1024)], {
      type: 'image/jpeg',
    })

    const POST = await loadHandler()
    const req = await makeFormRequest(file)
    const res = await POST(req as never, ctx as never)

    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; asset: Record<string, unknown> }
    expect(body.ok).toBe(true)
    expect(body.asset).toMatchObject({
      id: 'asset-1',
      role: 'client_added',
      sort_order: 999,
      aspect_ratio: '1:1',
    })
    expect(body.asset.public_url).toMatch(/post-media\//)

    expect(mockState.processPhotoCalls).toBe(1)
    expect(mockState.storageUploadCalls).toHaveLength(1)
    expect(mockState.storageUploadCalls[0].contentType).toBe('image/jpeg')
    expect(mockState.storageUploadCalls[0].path).toMatch(
      new RegExp(`^thai-sea/${VALID_POST_ID}/${VALID_POST_ID}-[a-z0-9]{10}\\.jpg$`),
    )
    expect(mockState.insertedAsset).toMatchObject({
      post_id: VALID_POST_ID,
      client_id: 'client-1',
      role: 'client_added',
      sort_order: 999,
      aspect_ratio: '1:1',
    })
    expect(mockState.insertedEvent).toMatchObject({
      client_id: 'client-1',
      post_id: VALID_POST_ID,
      type: 'photo_added',
    })
    expect(mockState.storageRemoveCalls).toEqual([])
  })

  it('2. Content-Length > 25MB → 413 + Thai message; processPhoto NOT called; no storage; no DB', async () => {
    const POST = await loadHandler()
    const req = makeRequest({
      contentLength: 30 * 1024 * 1024,
      contentType: 'multipart/form-data; boundary=xxx',
      body: '',
    })
    const res = await POST(req as never, ctx as never)
    expect(res.status).toBe(413)
    const body = (await res.json()) as { ok: boolean; error: string; message_th: string }
    expect(body).toMatchObject({
      ok: false,
      error: 'file_too_large',
      message_th: 'ไฟล์ใหญ่เกินไป (สูงสุด 25 MB)',
    })
    expect(mockState.processPhotoCalls).toBe(0)
    expect(mockState.storageUploadCalls).toEqual([])
    expect(mockState.insertedAsset).toBeNull()
    expect(mockState.insertedEvent).toBeNull()
  })

  it('3. body file size > 25MB (Content-Length absent or lying) → 413; no processing', async () => {
    mockState.postFetchResp = {
      data: { id: VALID_POST_ID, client_id: 'client-1', status: 'pending_review' },
      error: null,
    }
    const big = new Blob([new Uint8Array(26 * 1024 * 1024)], { type: 'image/jpeg' })

    const POST = await loadHandler()
    const req = await makeFormRequest(big)
    const res = await POST(req as never, ctx as never)
    expect(res.status).toBe(413)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('file_too_large')
    expect(mockState.processPhotoCalls).toBe(0)
    expect(mockState.storageUploadCalls).toEqual([])
    expect(mockState.insertedAsset).toBeNull()
  })

  it('4. missing x-client-id → 401 unauthenticated', async () => {
    mockState.headerOverride = new Headers() // empty
    const POST = await loadHandler()
    const file = new Blob([new Uint8Array(1024)], { type: 'image/jpeg' })
    const req = await makeFormRequest(file)
    const res = await POST(req as never, ctx as never)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body).toEqual({ ok: false, error: 'unauthenticated' })
  })

  it('5. cross-tenant: post.client_id !== x-client-id → 404 not_found', async () => {
    mockState.postFetchResp = {
      data: { id: VALID_POST_ID, client_id: 'client-OTHER', status: 'pending_review' },
      error: null,
    }
    const file = new Blob([new Uint8Array(1024)], { type: 'image/jpeg' })

    const POST = await loadHandler()
    const req = await makeFormRequest(file)
    const res = await POST(req as never, ctx as never)
    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body).toEqual({ ok: false, error: 'not_found' })
    expect(mockState.processPhotoCalls).toBe(0)
    expect(mockState.storageUploadCalls).toEqual([])
    expect(mockState.insertedAsset).toBeNull()
  })

  it('6. no file field in formData → 400 no_file', async () => {
    mockState.postFetchResp = {
      data: { id: VALID_POST_ID, client_id: 'client-1', status: 'pending_review' },
      error: null,
    }
    const fd = new FormData()
    fd.append('not_file', 'x')
    const req = new Request(
      'http://localhost/api/c/' + TOKEN + '/post/' + VALID_POST_ID + '/asset',
      { method: 'POST', body: fd },
    )

    const POST = await loadHandler()
    const res = await POST(req as never, ctx as never)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body).toEqual({ ok: false, error: 'no_file' })
  })

  it('7. processPhoto throws → 500 process_failed; no storage; no DB', async () => {
    mockState.postFetchResp = {
      data: { id: VALID_POST_ID, client_id: 'client-1', status: 'pending_review' },
      error: null,
    }
    mockState.processPhotoImpl = async () => {
      throw new Error('boom')
    }
    const file = new Blob([new Uint8Array(1024)], { type: 'image/jpeg' })

    const POST = await loadHandler()
    const req = await makeFormRequest(file)
    const res = await POST(req as never, ctx as never)
    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body).toEqual({ ok: false, error: 'process_failed' })
    expect(mockState.storageUploadCalls).toEqual([])
    expect(mockState.insertedAsset).toBeNull()
    expect(mockState.insertedEvent).toBeNull()

    const { logger } = await import('@/lib/logger')
    expect(logger.error).toHaveBeenCalled()
  })

  it('8. storage upload fails → 500 upload_failed; no DB writes', async () => {
    mockState.postFetchResp = {
      data: { id: VALID_POST_ID, client_id: 'client-1', status: 'pending_review' },
      error: null,
    }
    mockState.storageUploadResp = { data: null, error: { message: 'storage broken' } }
    const file = new Blob([new Uint8Array(1024)], { type: 'image/jpeg' })

    const POST = await loadHandler()
    const req = await makeFormRequest(file)
    const res = await POST(req as never, ctx as never)
    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body).toEqual({ ok: false, error: 'upload_failed' })
    expect(mockState.insertedAsset).toBeNull()
    expect(mockState.insertedEvent).toBeNull()
  })

  it('9. post_assets insert fails after storage upload → 500 db_error + rollback (storage.remove called)', async () => {
    mockState.postFetchResp = {
      data: { id: VALID_POST_ID, client_id: 'client-1', status: 'pending_review' },
      error: null,
    }
    mockState.assetInsertResp = {
      data: null,
      error: { message: 'unique constraint' },
    }
    const file = new Blob([new Uint8Array(1024)], { type: 'image/jpeg' })

    const POST = await loadHandler()
    const req = await makeFormRequest(file)
    const res = await POST(req as never, ctx as never)
    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body).toEqual({ ok: false, error: 'db_error' })
    expect(mockState.storageUploadCalls).toHaveLength(1)
    expect(mockState.storageRemoveCalls).toHaveLength(1)
    expect(mockState.storageRemoveCalls[0][0]).toBe(
      mockState.storageUploadCalls[0].path,
    )
    expect(mockState.insertedEvent).toBeNull()
  })

  it('10. HEIC input: events.payload includes input_mime, aspect_ratio, sizes', async () => {
    mockState.postFetchResp = {
      data: { id: VALID_POST_ID, client_id: 'client-1', status: 'pending_review' },
      error: null,
    }
    mockState.processPhotoImpl = async () => ({
      jpegBuffer: Buffer.from('FAKEJPEG_HEIC_DECODED_4_5'),
      width: 1638,
      height: 2048,
      aspectRatio: '4:5',
    })
    mockState.assetInsertResp = {
      data: {
        id: 'asset-2',
        storage_path: 'thai-sea/' + VALID_POST_ID + '/' + VALID_POST_ID + '-aaaaaaaaaa.jpg',
        role: 'client_added',
        sort_order: 999,
        aspect_ratio: '4:5',
      },
      error: null,
    }

    // Construct a HEIC blob — we set type=image/heic; mock processPhoto ignores buffer contents.
    const heicBytes = new Uint8Array(2 * 1024 * 1024)
    const file = new Blob([heicBytes], { type: 'image/heic' })

    const POST = await loadHandler()
    const req = await makeFormRequest(file)
    const res = await POST(req as never, ctx as never)
    expect(res.status).toBe(200)

    expect(mockState.insertedEvent).toMatchObject({
      type: 'photo_added',
      payload: expect.objectContaining({
        asset_id: 'asset-2',
        storage_path: expect.any(String),
        width: 1638,
        height: 2048,
        aspect_ratio: '4:5',
        input_mime: 'image/heic',
      }),
    })
    const payload = (mockState.insertedEvent as { payload: Record<string, number> }).payload
    expect(payload.original_size).toBe(heicBytes.length)
    expect(payload.output_size).toBe(
      Buffer.from('FAKEJPEG_HEIC_DECODED_4_5').length,
    )
  })
})
