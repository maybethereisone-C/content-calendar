/**
 * Type shim for `heic-convert@2.1.0` (no @types package on npm).
 * Source: package's index.d.ts is missing; signature derived from README + index.js.
 */
declare module 'heic-convert' {
  type Format = 'JPEG' | 'PNG'

  interface ConvertInput {
    /** Input HEIC bytes. The package accepts ArrayBuffer/Buffer/Uint8Array. */
    buffer: ArrayBuffer | Buffer | Uint8Array
    format: Format
    /** 0..1 (lossy formats only). */
    quality?: number
  }

  function convert(input: ConvertInput): Promise<ArrayBuffer>

  // The default export is also callable as `convert.all()` for multi-image HEIF.
  // Not used in v1; omit for now.

  export default convert
}
