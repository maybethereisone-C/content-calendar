import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const TOKEN = process.env.TEST_TOKEN
if (!TOKEN || TOKEN.length !== 32) {
  throw new Error(
    'TEST_TOKEN env var must be a 32-char nanoid (the Thai Sea seed token).'
  )
}

const ROUTES = [
  `/c/${TOKEN}/calendar`,
  `/c/${TOKEN}/post/seed-test-post-id`, // post id is irrelevant — placeholder page renders for any id
  '/random-404-path', // hits app/not-found.tsx
]

/**
 * REQ 24 / THEME-04: every routed page must have ZERO WCAG AA contrast
 * violations in DARK mode.
 *
 * The test forces the dark theme by setting localStorage BEFORE navigation,
 * so the FOUC inline script in app/layout.tsx applies it before paint.
 */
for (const path of ROUTES) {
  test(`Dark mode WCAG AA -- ${path}`, async ({ page, context }) => {
    // Force dark theme via localStorage init script BEFORE navigation
    await context.addInitScript(() => {
      try {
        localStorage.setItem('theme', 'dark')
      } catch {}
    })
    await page.goto(path)
    await page.waitForLoadState('networkidle')

    // Sanity: confirm dark mode actually applied
    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )
    expect(dataTheme).toBe('dark')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa', 'wcag2a'])
      .analyze()

    // Filter to contrast-only violations for the strict gate; report all for visibility
    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced'
    )

    if (results.violations.length > 0) {
      console.log(
        'All AA violations:',
        JSON.stringify(results.violations, null, 2)
      )
    }

    expect(
      contrastViolations,
      'WCAG AA color-contrast violations in dark mode'
    ).toEqual([])
  })

  test(`Light mode WCAG AA (no regression) -- ${path}`, async ({
    page,
    context,
  }) => {
    await context.addInitScript(() => {
      try {
        localStorage.setItem('theme', 'light')
      } catch {}
    })
    await page.goto(path)
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze()

    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced'
    )
    expect(contrastViolations).toEqual([])
  })
}

/**
 * Phase 2 / 02-02: chip + badge palette coverage.
 *
 * UI-SPEC §"Color" defines four StatusChip variants (pending/approved/needs-tew
 * /published) and four ChannelBadge tints (instagram/facebook/tiktok/x). Each
 * must clear WCAG AA (4.5:1 normal, 3:1 large) in BOTH light and dark mode.
 *
 * Per plan-action recommendation, the test renders a hand-built HTML fixture
 * via `page.setContent` rather than mounting a Next.js route. This keeps the
 * axe surface out of the production bundle and lets us assert against pure CSS
 * variables without spinning up a dev server.
 *
 * The fixture inlines the same `:root` and `[data-theme="dark"]` blocks from
 * `app/globals.css` so the values under test are byte-identical to production.
 */
const CHIP_BADGE_FIXTURE = `<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --bg: #F8F9FA;
        --surface: #FFFFFF;
        --surface-2: #F1F3F5;
        --border: #E9ECEF;
        --text: #212529;
        --text-mut: #6C757D;
        --chip-pending-bg: #FEF3C7;
        --chip-pending-fg: #92400E;
        --chip-approved-bg: #DBEAFE;
        --chip-approved-fg: #1E40AF;
        --chip-needs-tew-bg: #FEE2E2;
        --chip-needs-tew-fg: #991B1B;
        --chip-published-bg: var(--surface-2);
        --chip-published-fg: #5C677A;
      }
      [data-theme="dark"] {
        --bg: #0F172A;
        --surface: #1E293B;
        --surface-2: #334155;
        --border: #334155;
        --text: #F1F5F9;
        --text-mut: #94A3B8;
        --chip-pending-bg: #3F2A0E;
        --chip-pending-fg: #FCD34D;
        --chip-approved-bg: #1E3A8A;
        --chip-approved-fg: #BFDBFE;
        --chip-needs-tew-bg: #7F1D1D;
        --chip-needs-tew-fg: #FCA5A5;
        --chip-published-bg: var(--surface-2);
        --chip-published-fg: #A0AEC2;
      }
      html, body { background: var(--bg); color: var(--text); margin: 0; padding: 24px; font-family: system-ui, sans-serif; }
      .chip { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; line-height: 1; margin: 4px; }
      .chip[data-status-chip="pending"]   { background: var(--chip-pending-bg);   color: var(--chip-pending-fg); }
      .chip[data-status-chip="approved"]  { background: var(--chip-approved-bg);  color: var(--chip-approved-fg); }
      .chip[data-status-chip="needs-tew"] { background: var(--chip-needs-tew-bg); color: var(--chip-needs-tew-fg); }
      .chip[data-status-chip="published"] { background: var(--chip-published-bg); color: var(--chip-published-fg); }
      .badge { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; background: var(--surface-2); color: var(--text-mut); margin: 4px; font-size: 14px; }
    </style>
  </head>
  <body>
    <h1 style="color: var(--text); font-size: 14px;">Chip + badge palette fixture</h1>
    <p>
      <span class="chip" data-status-chip="pending">รอตรวจ</span>
      <span class="chip" data-status-chip="approved">อนุมัติแล้ว</span>
      <span class="chip" data-status-chip="needs-tew">รอทิว</span>
      <span class="chip" data-status-chip="published">โพสต์แล้ว</span>
    </p>
    <p>
      <span class="badge" aria-label="instagram"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg></span>
      <span class="badge" aria-label="facebook"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg></span>
      <span class="badge" aria-label="tiktok"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg></span>
      <span class="badge" aria-label="x"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg></span>
    </p>
  </body>
</html>`

for (const theme of ['light', 'dark'] as const) {
  test(`Chip + badge palette WCAG AA -- ${theme} mode`, async ({ page }) => {
    await page.setContent(CHIP_BADGE_FIXTURE)
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t)
    }, theme)

    const results = await new AxeBuilder({ page })
      .include('.chip, .badge')
      .withTags(['wcag2aa'])
      .analyze()

    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced'
    )
    if (contrastViolations.length > 0) {
      console.log(
        `Chip palette ${theme} contrast violations:`,
        JSON.stringify(contrastViolations, null, 2)
      )
    }
    expect(contrastViolations).toEqual([])
  })
}
