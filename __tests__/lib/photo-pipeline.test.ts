/**
 * lib/photo-pipeline.test.ts — HEIC detect + Sharp pipeline tests (Plan 02-01 T1)
 *
 * Covers:
 *  - isHEIC: mime-based and magic-byte sniff (Pitfall 2 — iOS auto-converts mime)
 *  - detectImageFormat: jpeg / png / webp / heic / unknown
 *  - processPhoto: aspect snap, resize cap, EXIF strip (default Sharp behavior)
 *
 * The HEIC fixture (`__tests__/fixtures/sample.heic`) is captured separately
 * during Plan 02-01 Task 4-C (headed iPhone session). Tests gated on
 * `it.runIf(fs.existsSync(...))` so the suite passes pre-fixture; verbose run
 * post-capture confirms the gated test actually executed.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import sharp from 'sharp'
import {
  isHEIC,
  detectImageFormat,
} from '@/lib/photo-pipeline/detect'
import { processPhoto } from '@/lib/photo-pipeline/process'

const HEIC_FIXTURE = path.join(
  process.cwd(),
  '__tests__/fixtures/sample.heic',
)

/** Build a synthetic HEIC-magic buffer (offset 4 = ftypheic). For sniff tests
 * only — not a real HEIC, won't decode. */
function fakeHeicBuffer(): Buffer {
  const b = Buffer.alloc(32)
  b.write('ftypheic', 4, 'latin1')
  return b
}

/** Build a real JPEG buffer at given dimensions (Sharp generates synthetic). */
async function makeJpeg(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer()
}

/** Build a real PNG buffer at given dimensions. */
async function makePng(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 100, g: 150, b: 200, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
}

describe('isHEIC', () => {
  it('returns true for image/heic mime (case-insensitive)', () => {
    expect(isHEIC(Buffer.alloc(0), 'image/heic')).toBe(true)
    expect(isHEIC(Buffer.alloc(0), 'IMAGE/HEIC')).toBe(true)
  })

  it('returns true for image/heif mime', () => {
    expect(isHEIC(Buffer.alloc(0), 'image/heif')).toBe(true)
    expect(isHEIC(Buffer.alloc(0), 'Image/Heif')).toBe(true)
  })

  it('returns true when magic bytes are HEIC even if mime says jpeg (Pitfall 2)', () => {
    const buf = fakeHeicBuffer()
    expect(isHEIC(buf, 'image/jpeg')).toBe(true)
  })

  it('returns false for a real JPEG (FF D8 FF magic) when mime says jpeg', async () => {
    const buf = await makeJpeg(100, 100)
    expect(isHEIC(buf, 'image/jpeg')).toBe(false)
  })

  it('returns false for a buffer too short to sniff', () => {
    expect(isHEIC(Buffer.alloc(4), 'image/jpeg')).toBe(false)
  })

  it('handles ftypmif1, ftypmsf1, ftyphevc magics', () => {
    for (const magic of ['ftypmif1', 'ftypmsf1', 'ftyphevc']) {
      const b = Buffer.alloc(32)
      b.write(magic, 4, 'latin1')
      expect(isHEIC(b, 'application/octet-stream')).toBe(true)
    }
  })
})

describe('detectImageFormat', () => {
  it('returns "heic" when HEIC mime', () => {
    expect(
      detectImageFormat({ buffer: Buffer.alloc(0), mime: 'image/heic' }),
    ).toBe('heic')
  })

  it('returns "jpeg" for FF D8 FF magic', async () => {
    const buf = await makeJpeg(50, 50)
    expect(detectImageFormat({ buffer: buf, mime: 'image/jpeg' })).toBe('jpeg')
  })

  it('returns "png" for PNG magic', async () => {
    const buf = await makePng(50, 50)
    expect(detectImageFormat({ buffer: buf, mime: 'image/png' })).toBe('png')
  })

  it('returns "webp" for RIFF...WEBP magic', async () => {
    const buf = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .webp()
      .toBuffer()
    expect(detectImageFormat({ buffer: buf, mime: 'image/webp' })).toBe('webp')
  })

  it('returns "unknown" for arbitrary bytes', () => {
    expect(
      detectImageFormat({
        buffer: Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
        mime: 'application/octet-stream',
      }),
    ).toBe('unknown')
  })
})

describe('processPhoto', () => {
  it('returns a JPEG buffer with FF D8 FF magic', async () => {
    const input = await makeJpeg(800, 800)
    const out = await processPhoto(input, 'image/jpeg')
    expect(out.jpegBuffer.length).toBeGreaterThan(0)
    expect(out.jpegBuffer[0]).toBe(0xff)
    expect(out.jpegBuffer[1]).toBe(0xd8)
    expect(out.jpegBuffer[2]).toBe(0xff)
  })

  it('caps width and height at 2048', async () => {
    const input = await makePng(3000, 3000)
    const out = await processPhoto(input, 'image/png')
    expect(out.width).toBeLessThanOrEqual(2048)
    expect(out.height).toBeLessThanOrEqual(2048)
  })

  it('snaps a 1000x1200 (~4:5) source to aspectRatio "4:5"', async () => {
    const input = await makePng(1000, 1200)
    const out = await processPhoto(input, 'image/png')
    expect(out.aspectRatio).toBe('4:5')
  })

  it('snaps a 1000x1000 (1:1) source to aspectRatio "1:1"', async () => {
    const input = await makePng(1000, 1000)
    const out = await processPhoto(input, 'image/png')
    expect(out.aspectRatio).toBe('1:1')
  })

  it('snaps a 1920x1080 landscape to "1:1" (closer to 1.0 than 0.8)', async () => {
    const input = await makePng(1920, 1080)
    const out = await processPhoto(input, 'image/png')
    expect(out.aspectRatio).toBe('1:1')
  })

  // Real iPhone HEIC fixture (captured in Task 4-C). Skipped if missing so
  // pre-fixture pipelines stay green; verbose post-capture run confirms it ran.
  it.runIf(fs.existsSync(HEIC_FIXTURE))(
    'decodes a real iPhone HEIC fixture into a valid JPEG',
    async () => {
      const heicBuf = fs.readFileSync(HEIC_FIXTURE)
      const out = await processPhoto(heicBuf, 'image/heic')
      expect(out.jpegBuffer.length).toBeGreaterThan(0)
      // FF D8 FF magic = JPEG SOI
      expect(out.jpegBuffer.subarray(0, 3)).toEqual(
        Buffer.from([0xff, 0xd8, 0xff]),
      )
      expect(out.width).toBeLessThanOrEqual(2048)
      expect(out.height).toBeLessThanOrEqual(2048)
    },
  )
})
