/**
 * lib/photo-pipeline/process.ts — HEIC pre-decode + Sharp resize/strip pipeline
 *
 * D-04 CORRECTION (per 02-RESEARCH.md, REVISED 2026-05-07):
 *   Sharp's prebuilt libvips does NOT include HEIC decode (Nokia HEIF patent
 *   licensing). The CONTEXT.md fallback to `jimp + @jimp/heif` is invalid —
 *   `@jimp/heif` does not exist on npm. Pipeline shipped:
 *
 *     1. If isHEIC(buffer, mime) → heic-convert decodes to JPEG (lossless q=1)
 *     2. Sharp .rotate()                          (auto-orient via EXIF)
 *     3. Compute target aspect (1:1 or 4:5)       (whichever closer to source)
 *     4. .resize(target, fit:'cover', center, withoutEnlargement)
 *     5. .jpeg({ quality:85, mozjpeg:true })
 *     6. EXIF/IPTC/XMP/ICC stripped (Sharp default — no .keepMetadata())
 *
 * Threat coverage:
 *   - T-02-01-02 (DoS via Sharp resize): cap 2048×2048; Sharp's default failOn
 *     rejects malformed input.
 *   - T-02-01-03 (DoS via heic-convert): rejected promise propagates as Error
 *     to the route handler, which returns generic 500.
 *   - T-02-01-04 (EXIF leak): Sharp default strips all metadata; verified via
 *     exiftool in Plan 02-01 Task 4-C.
 */

import sharp from 'sharp'
import convert from 'heic-convert'
import { isHEIC } from './detect'

export interface ProcessedPhoto {
  jpegBuffer: Buffer
  width: number
  height: number
  aspectRatio: '1:1' | '4:5'
}

/**
 * Process an upload buffer into a normalized JPEG.
 *
 * @param inputBuffer - raw bytes from `request.formData()`
 * @param inputMime - the client-reported Content-Type (sniff still runs internally)
 * @throws Error('process_photo_no_metadata') if Sharp can't read dimensions
 * @throws Error from heic-convert / Sharp on malformed input (caller wraps as 500)
 */
export async function processPhoto(
  inputBuffer: Buffer,
  inputMime: string,
): Promise<ProcessedPhoto> {
  // Step 1: HEIC pre-decode (Sharp's libvips can't read HEIC).
  let bufferForSharp: Buffer = inputBuffer
  if (isHEIC(inputBuffer, inputMime)) {
    const out = await convert({
      buffer: inputBuffer as unknown as ArrayBuffer,
      format: 'JPEG',
      quality: 1, // lossless pre-decode; Sharp re-encodes at q=0.85 below
    })
    bufferForSharp = Buffer.from(out)
  }

  // Step 2: Read source metadata (after EXIF auto-rotate via .rotate()).
  const meta = await sharp(bufferForSharp).rotate().metadata()
  if (!meta.width || !meta.height) {
    throw new Error('process_photo_no_metadata')
  }

  // Step 3: Aspect snap — pick the closer of {1:1 = 1.0, 4:5 = 0.8}.
  const srcRatio = meta.width / meta.height
  const dist1 = Math.abs(srcRatio - 1.0)
  const dist45 = Math.abs(srcRatio - 0.8)
  const aspectRatio: '1:1' | '4:5' = dist1 <= dist45 ? '1:1' : '4:5'

  // Step 4: Compute target dimensions, capped at 2048 long side.
  let targetW: number
  let targetH: number
  if (aspectRatio === '1:1') {
    const longest = Math.min(2048, Math.min(meta.width, meta.height))
    targetW = longest
    targetH = longest
  } else {
    targetH = Math.min(2048, meta.height)
    targetW = Math.round(targetH * 0.8)
    if (targetW > meta.width) {
      targetW = meta.width
      targetH = Math.round(targetW / 0.8)
    }
  }

  // Step 5: Resize + re-encode. Sharp default = strip all metadata.
  const jpegBuffer = await sharp(bufferForSharp)
    .rotate()
    .resize({
      width: targetW,
      height: targetH,
      fit: 'cover',
      position: 'center',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer()

  return { jpegBuffer, width: targetW, height: targetH, aspectRatio }
}
