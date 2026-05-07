/**
 * lib/photo-pipeline/detect.ts — HEIC magic-byte sniff + format detector
 *
 * Why magic-byte sniff: iOS Safari sometimes auto-converts to JPEG (so mime says
 * `image/jpeg` but the actual bytes are HEIC), and sometimes passes HEIC through
 * with `image/heic`. Trusting Content-Type alone leaks the case-1 path into Sharp,
 * which then fails because Sharp's prebuilt libvips lacks HEIC decode (Pitfall 2
 * in 02-RESEARCH.md).
 *
 * HEIC ftyp magics live at offset 4 of an ISO BMFF box. We allow-list the brand
 * codes used by HEIC/HEIF/HEVC variants. Source: ISO/IEC 14496-12 + nokiatech HEIF.
 */

const HEIC_MAGIC = [
  'ftypheic',
  'ftypmif1',
  'ftypmsf1',
  'ftyphevc',
  'ftypheix',
  'ftyphevx',
] as const

/**
 * Returns true when the buffer is HEIC, judged by mime first then magic bytes.
 * Mime check covers iOS native upload (image/heic|heif). Magic check covers
 * iOS auto-conversion mismatch where mime claims jpeg but bytes are HEIC.
 */
export function isHEIC(buffer: Buffer, mime: string): boolean {
  const m = (mime ?? '').toLowerCase()
  if (m === 'image/heic' || m === 'image/heif') return true
  if (buffer.length < 12) return false
  const ftyp = buffer.subarray(4, 12).toString('latin1')
  return HEIC_MAGIC.some((p) => ftyp.startsWith(p))
}

export type ImageFormat = 'heic' | 'jpeg' | 'png' | 'webp' | 'unknown'

/**
 * Magic-byte format sniff. Used by upload route to reject unsupported formats
 * before they reach Sharp (which would throw a generic "Input buffer contains
 * unsupported image format" error that we don't want surfaced to the user).
 */
export function detectImageFormat({
  buffer,
  mime,
}: {
  buffer: Buffer
  mime: string
}): ImageFormat {
  if (isHEIC(buffer, mime)) return 'heic'
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpeg'
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer.subarray(1, 4).toString('latin1') === 'PNG'
  ) {
    return 'png'
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp'
  }
  return 'unknown'
}
