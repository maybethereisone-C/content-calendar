/**
 * exif-smoke.ts — One-off PHOTO-02 acceptance gate.
 *
 * Runs processPhoto() on a fixture HEIC (or other supported image), writes
 * the JPEG output to /tmp, runs `exiftool` on the output, and asserts:
 *   1. Zero GPS / Make / Model / DateTimeOriginal tags remain
 *   2. Long edge ≤ 2048px
 *   3. Output is valid JPEG bytes (Sharp succeeded)
 *
 * Usage:
 *   cd app && npx tsx scripts/exif-smoke.ts __tests__/fixtures/sample.heic
 *
 * Exit codes:
 *   0  — PASS (all three checks)
 *   1  — FAIL (one or more assertions failed; see stderr)
 *   2  — Bad invocation (no fixture path / fixture missing)
 *
 * Requires: brew install exiftool (or apt-get install libimage-exiftool-perl)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { processPhoto } from '../lib/photo-pipeline/process'

async function main() {
  const fixture = process.argv[2]
  if (!fixture) {
    console.error('usage: exif-smoke.ts <path-to-fixture>')
    process.exit(2)
  }
  if (!existsSync(fixture)) {
    console.error(`fixture not found: ${fixture}`)
    process.exit(2)
  }

  const buffer = readFileSync(fixture)
  const lower = fixture.toLowerCase()
  const mime = lower.endsWith('.heic')
    ? 'image/heic'
    : lower.endsWith('.heif')
      ? 'image/heif'
      : lower.endsWith('.png')
        ? 'image/png'
        : 'image/jpeg'

  console.log(`Input: ${buffer.length} bytes, mime=${mime}`)

  const out = await processPhoto(buffer, mime)
  const outPath = '/tmp/exif-smoke-out.jpg'
  writeFileSync(outPath, out.jpegBuffer)
  console.log(
    `Output: ${out.jpegBuffer.length} bytes, ${out.width}x${out.height}, aspect=${out.aspectRatio}`,
  )
  console.log(`Wrote ${outPath}`)

  // exiftool: query GPS + EXIF identifying tags. Should be empty after Sharp strip.
  let tags = ''
  try {
    tags = execSync(
      `exiftool -GPS:all -EXIF:Make -EXIF:Model -EXIF:DateTimeOriginal "${outPath}"`,
      { encoding: 'utf8' },
    )
  } catch (e) {
    console.error('exiftool failed:', (e as Error).message)
    process.exit(1)
  }

  console.log('--- exiftool output ---')
  console.log(tags || '(empty — zero matching tags)')

  // Acceptance: any line mentioning GPS|Make|Model|DateTimeOriginal that isn't
  // an exiftool banner is a leak.
  const offenders = tags
    .split('\n')
    .filter(
      (l) =>
        /(GPS|Make|Model|DateTimeOriginal)/i.test(l) && !/ExifTool/.test(l),
    )
  if (offenders.length > 0) {
    console.error('FAIL: EXIF tags present:', offenders)
    process.exit(1)
  }
  console.log('PASS: zero EXIF GPS/Make/Model/DateTime tags')

  // Long-edge check.
  const longest = Math.max(out.width, out.height)
  if (longest > 2048) {
    console.error(`FAIL: long edge ${longest} > 2048`)
    process.exit(1)
  }
  console.log(`PASS: long edge ${longest} ≤ 2048`)

  // JPEG SOI bytes (FF D8 FF) sanity.
  const soi = out.jpegBuffer.subarray(0, 3)
  if (soi[0] !== 0xff || soi[1] !== 0xd8 || soi[2] !== 0xff) {
    console.error('FAIL: output is not a JPEG (no SOI marker)')
    process.exit(1)
  }
  console.log('PASS: output begins with JPEG SOI bytes')

  console.log('\nALL CHECKS PASSED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
