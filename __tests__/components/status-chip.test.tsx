/**
 * StatusChip RSC presentation primitive — D-09 / UI-SPEC §Components / CAL-02.
 *
 * Renders a 999px-radius pill mapping ChipVariant → CSS-var palette + Thai label.
 * Behavior gates:
 *   - Each variant resolves to its own --chip-*-bg / --chip-*-fg pair.
 *   - `published` reuses --surface-2 / --text-mut (no dedicated var per UI-SPEC).
 *   - The Thai `label` prop is rendered verbatim (not translated via next-intl).
 *   - data-status-chip attribute mirrors the variant for stylesheet hooks.
 */
import { render, screen } from '@testing-library/react'
import { StatusChip } from '@/app/_components/status-chip'

describe('StatusChip', () => {
  it('renders pending variant with chip-pending CSS vars', () => {
    render(<StatusChip variant="pending" label="รอตรวจ" />)
    const el = screen.getByText('รอตรวจ')
    expect(el).toHaveAttribute('data-status-chip', 'pending')
    expect(el.getAttribute('style')).toContain('var(--chip-pending-bg)')
    expect(el.getAttribute('style')).toContain('var(--chip-pending-fg)')
  })

  it('renders approved variant with chip-approved CSS vars', () => {
    render(<StatusChip variant="approved" label="อนุมัติแล้ว" />)
    const el = screen.getByText('อนุมัติแล้ว')
    expect(el).toHaveAttribute('data-status-chip', 'approved')
    expect(el.getAttribute('style')).toContain('var(--chip-approved-bg)')
    expect(el.getAttribute('style')).toContain('var(--chip-approved-fg)')
  })

  it('renders needs-tew variant with chip-needs-tew CSS vars', () => {
    render(<StatusChip variant="needs-tew" label="รอทิว" />)
    const el = screen.getByText('รอทิว')
    expect(el).toHaveAttribute('data-status-chip', 'needs-tew')
    expect(el.getAttribute('style')).toContain('var(--chip-needs-tew-bg)')
    expect(el.getAttribute('style')).toContain('var(--chip-needs-tew-fg)')
  })

  it('renders published variant reusing surface-2 + text-mut (no dedicated chip var)', () => {
    render(<StatusChip variant="published" label="โพสต์แล้ว" />)
    const el = screen.getByText('โพสต์แล้ว')
    expect(el).toHaveAttribute('data-status-chip', 'published')
    expect(el.getAttribute('style')).toContain('var(--surface-2)')
    expect(el.getAttribute('style')).toContain('var(--text-mut)')
  })
})
