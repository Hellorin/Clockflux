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

  it('adds last year\'s unused balance into the total when carryover is enabled', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    // 2023: 20 allowance, 5 used -> 15 unused carried into 2024.
    render(
      <HolidayPage
        used={0}
        daysOff={{ '2023-06-01': 'personal', '2023-06-02': 'personal', '2023-06-03': 'personal', '2023-06-04': 'personal', '2023-06-05': 'personal' }}
        allowance={20}
        startDate="2020-01-01"
        accrualMode="immediate"
        carryoverEnabled
      />
    )
    expect(screen.getAllByText(/carried over/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Your unused days will carry over into the new year/)).toBeInTheDocument()
  })

  it('ignores last year\'s unused balance when carryover is disabled (default)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    render(
      <HolidayPage
        used={0}
        daysOff={{ '2023-06-01': 'personal' }}
        allowance={20}
        startDate="2020-01-01"
        accrualMode="immediate"
      />
    )
    expect(screen.queryByText(/carried over/)).not.toBeInTheDocument()
  })

  it('shows a Pro upsell note when carryover is not enabled', () => {
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
    expect(screen.getByText(/Free plan: unused days don't carry over/)).toBeInTheDocument()
    expect(screen.getByText('✦')).toBeInTheDocument()
  })

  it('shows a "turn it on" note when the plan unlocks carryover but the setting is off', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    render(
      <HolidayPage
        used={2}
        daysOff={{}}
        allowance={24}
        startDate="2024-01-01"
        accrualMode="immediate"
        carryoverAvailable
      />
    )
    expect(screen.getByText(/turn on carryover in Settings/)).toBeInTheDocument()
    expect(screen.queryByText(/Free plan: unused days don't carry over/)).not.toBeInTheDocument()
  })
})
