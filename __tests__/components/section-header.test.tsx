/**
 * SectionHeader RSC presentation primitive — UI-SPEC §Components / CAL-04.
 *
 * Renders a 13px/600 muted heading like "ต้องตรวจ · 3" / "อนุมัติแล้ว · 5".
 * Behavior gates:
 *   - count === 0 → returns null (empty section omitted entirely, NOT "0 posts").
 *   - count > 0  → renders an <h2> with the "{label} · {count}" pattern.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionHeader } from '@/app/_components/section-header'

describe('SectionHeader', () => {
  it('returns null when count === 0', () => {
    const { container } = render(<SectionHeader label="ต้องตรวจ" count={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders {label} · {count} when count > 0', () => {
    render(<SectionHeader label="ต้องตรวจ" count={3} />)
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2.textContent).toBe('ต้องตรวจ · 3')
  })

  it('uses muted text color via --text-mut', () => {
    render(<SectionHeader label="อนุมัติแล้ว" count={5} />)
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2.getAttribute('style')).toContain('var(--text-mut)')
  })
})
