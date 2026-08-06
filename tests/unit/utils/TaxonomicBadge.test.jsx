import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TaxonomicBadge from '@/utils/TaxonomicBadge'

describe('TaxonomicBadge', () => {
  it('renders nothing when show is false', () => {
    const { container } = render(
      <TaxonomicBadge label="Order" correct={false} show={false} value="Passeriformes" />,
    )

    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(/Order/)).not.toBeInTheDocument()
  })

  it('renders a checkmark for a correct match without a value', () => {
    render(<TaxonomicBadge label="Order" correct show />)

    const badge = screen.getByText('Order ✓')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-green-100', 'text-green-700')
  })

  it('renders a cross for an incorrect match without a value', () => {
    render(<TaxonomicBadge label="Family" correct={false} show />)

    const badge = screen.getByText('Family ✗')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-red-100', 'text-red-700')
  })

  it('displays the taxonomic value for a correct match', () => {
    render(
      <TaxonomicBadge label="Order" correct show value="Passeriformes" />,
    )

    expect(screen.getByText('Order: Passeriformes ✓')).toBeInTheDocument()
    expect(screen.queryByText('Order: Passeriformes ✗')).not.toBeInTheDocument()
  })

  it('displays the taxonomic value for an incorrect match', () => {
    render(
      <TaxonomicBadge label="Genus" correct={false} show value="Turdus" />,
    )

    expect(screen.getByText('Genus: Turdus ✗')).toBeInTheDocument()
  })

  it('uses correct colors for a value-bearing incorrect badge', () => {
    render(
      <TaxonomicBadge label="Species" correct={false} show value="migratorius" />,
    )

    expect(screen.getByText('Species: migratorius ✗')).toHaveClass(
      'bg-red-100',
      'text-red-700',
    )
  })
})
