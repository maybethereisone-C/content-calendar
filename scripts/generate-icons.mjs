/**
 * scripts/generate-icons.mjs
 *
 * Generate proper PWA install icons via Playwright screenshot.
 * Replaces the qlmanage stub used in Phase 1.
 *
 * Output: public/icons/icon-192.png + public/icons/icon-512.png
 *
 * Design: full-canvas #2563EB blue with a centered white CalendarDays glyph
 * sized at ~42% of canvas — small enough to survive iOS/Android maskable
 * 80%-safe-zone cropping, large enough to read at small sizes.
 *
 * Run: node scripts/generate-icons.mjs
 * Requires: npm install (Playwright already in devDependencies).
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT_DIR = resolve('public/icons')
mkdirSync(OUT_DIR, { recursive: true })

// White CalendarDays glyph SVG (from lucide-static, simplified to inline path).
const CALENDAR_DAYS_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">
    <path d="M8 2v4"/>
    <path d="M16 2v4"/>
    <rect width="18" height="18" x="3" y="4" rx="2"/>
    <path d="M3 10h18"/>
    <path d="M8 14h.01"/>
    <path d="M12 14h.01"/>
    <path d="M16 14h.01"/>
    <path d="M8 18h.01"/>
    <path d="M12 18h.01"/>
    <path d="M16 18h.01"/>
  </svg>
`

function html(size) {
  // Glyph is 42% of canvas — fits inside the 80% safe-zone for maskable variants.
  const glyphSize = Math.round(size * 0.42)
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; }
  body {
    width: ${size}px;
    height: ${size}px;
    background: #2563EB;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .glyph { width: ${glyphSize}px; height: ${glyphSize}px; }
</style></head><body>
  <div class="glyph">${CALENDAR_DAYS_SVG}</div>
</body></html>`
}

const APP_DIR = resolve('app')

const browser = await chromium.launch()
try {
  // Manifest icons (Chrome/Android/Edge): 192 + 512
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(html(size), { waitUntil: 'load' })
    const buf = await page.screenshot({ type: 'png', omitBackground: false })
    const out = resolve(OUT_DIR, `icon-${size}.png`)
    writeFileSync(out, buf)
    console.log(`  wrote ${out} (${buf.length.toLocaleString()} bytes)`)
    await page.close()
  }

  // Apple touch icon (iOS Safari home-screen): 180x180.
  // Next.js auto-emits <link rel="apple-touch-icon"> when this file exists at app/apple-icon.png.
  // iOS does NOT read the manifest icons — apple-touch-icon is the only icon iOS Safari respects.
  const appleSize = 180
  const applePage = await browser.newPage({ viewport: { width: appleSize, height: appleSize } })
  await applePage.setContent(html(appleSize), { waitUntil: 'load' })
  const appleBuf = await applePage.screenshot({ type: 'png', omitBackground: false })
  const appleOut = resolve(APP_DIR, `apple-icon.png`)
  writeFileSync(appleOut, appleBuf)
  console.log(`  wrote ${appleOut} (${appleBuf.length.toLocaleString()} bytes)`)
  await applePage.close()
} finally {
  await browser.close()
}

console.log('done')
