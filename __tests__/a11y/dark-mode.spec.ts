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
