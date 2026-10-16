import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PriorityBadge, RoleBadge, StatusBadge } from '../components/StatusBadge'

describe('Badges', () => {
  it('renders status badge with formatted label and class', () => {
    const { rerender } = render(<StatusBadge status="open" />)
    expect(screen.getByText('open')).toBeInTheDocument()
    expect(screen.getByText('open')).toHaveClass('badge-status-open')

    rerender(<StatusBadge status="in_progress" />)
    expect(screen.getByText('in progress')).toBeInTheDocument()
    expect(screen.getByText('in progress')).toHaveClass('badge-status-in_progress')

    rerender(<StatusBadge status="resolved" />)
    expect(screen.getByText('resolved')).toBeInTheDocument()
    expect(screen.getByText('resolved')).toHaveClass('badge-status-resolved')
  })

  it('renders priority badge correctly', () => {
    const { rerender } = render(<PriorityBadge priority="urgent" />)
    expect(screen.getByText('urgent')).toBeInTheDocument()
    expect(screen.getByText('urgent')).toHaveClass('badge-priority-urgent')

    rerender(<PriorityBadge priority="low" />)
    expect(screen.getByText('low')).toBeInTheDocument()
    expect(screen.getByText('low')).toHaveClass('badge-priority-low')
  })

  it('renders role badge correctly', () => {
    render(<RoleBadge role="owner" />)
    expect(screen.getByText('owner')).toBeInTheDocument()
    expect(screen.getByText('owner')).toHaveClass('badge-role')
  })
})
