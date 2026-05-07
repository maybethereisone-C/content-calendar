/**
 * ChannelBadge RSC presentation primitive — UI-SPEC §Components Q4=1 / CAL-02.
 *
 * 24×24 rounded `var(--surface-2)` square containing a centered 14×14 lucide icon
 * tinted `var(--text-mut)`. Maps platform → lucide icon (neutral, not brand-color).
 * Behavior gates:
 *   - 24×24 px container, border-radius 6px, surface-2 background.
 *   - aria-label = platform string (so screen readers announce it).
 *   - icon child rendered inline with aria-hidden.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ChannelBadge } from '@/app/_components/channel-badge'

describe('ChannelBadge', () => {
  it.each([
    ['instagram'],
    ['facebook'],
    ['tiktok'],
    ['x'],
    ['line'],
  ] as const)('renders %s platform with aria-label and surface-2 square', (platform) => {
    const { container } = render(<ChannelBadge platform={platform} />)
    const span = container.querySelector(`[aria-label="${platform}"]`)
    expect(span).not.toBeNull()
    expect(span!.getAttribute('style')).toContain('var(--surface-2)')
    expect(span!.getAttribute('style')).toMatch(/width:\s*24px/)
    expect(span!.getAttribute('style')).toMatch(/height:\s*24px/)
    // lucide-react renders an <svg> child
    const svg = span!.querySelector('svg')
    expect(svg).not.toBeNull()
  })
})
