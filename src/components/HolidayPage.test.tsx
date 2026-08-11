import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import HolidayPage from './HolidayPage'

describe('HolidayPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows available days and the ok year-end projection badge', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    render(
      <HolidayPage
        used={2}
        daysOff={{}}
        allowance={24}
        startDate="2024-01-01"
        accrualMode="immediate"
      />
    )
    expect(screen.getByText('Holiday balance')).toBeInTheDocument()
    expect(screen.getByText(/days to spare/)).toBeInTheDocument()
  })

  it('shows the "over" badge when projected usage exceeds the allowance', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    render(
      <HolidayPage
        used={20}
        daysOff={{ '2024-12-20': 'personal' }}
        allowance={10}
        startDate="2024-01-01"
        accrualMode="immediate"
      />
    )
    expect(screen.getByText(/days over by year end/)).toBeInTheDocument()
  })

  it('marks the card as overspent when available balance is negative', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-02-01T12:00:00'))
    const { container } = render(
      <HolidayPage
        used={10}
        daysOff={{}}
        allowance={24}
        startDate="2024-01-01"
        accrualMode="gradual"
      />
    )
    expect(container.querySelector('.holiday-card--over')).not.toBeNull()
    expect(screen.getByText(/days ahead of your accrual/)).toBeInTheDocument()
  })
})
