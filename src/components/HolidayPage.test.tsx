import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
        onAllowanceChange={() => {}}
        startDate="2024-01-01"
        onStartDateChange={() => {}}
        accrualMode="immediate"
        onAccrualModeChange={() => {}}
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
        onAllowanceChange={() => {}}
        startDate="2024-01-01"
        onStartDateChange={() => {}}
        accrualMode="immediate"
        onAccrualModeChange={() => {}}
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
        onAllowanceChange={() => {}}
        startDate="2024-01-01"
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
      />
    )
    expect(container.querySelector('.holiday-card--over')).not.toBeNull()
    expect(screen.getByText(/days ahead of your accrual/)).toBeInTheDocument()
  })

  it('toggles the settings panel and updates allowance, start date, and accrual mode', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    const onAllowanceChange = vi.fn()
    const onStartDateChange = vi.fn()
    const onAccrualModeChange = vi.fn()
    render(
      <HolidayPage
        used={2}
        daysOff={{}}
        allowance={24}
        onAllowanceChange={onAllowanceChange}
        startDate="2024-03-01"
        onStartDateChange={onStartDateChange}
        accrualMode="gradual"
        onAccrualModeChange={onAccrualModeChange}
      />
    )
    fireEvent.click(screen.getByText('Edit'))
    expect(screen.getByText('Done')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Annual holiday allowance'), { target: { value: '30' } })
    expect(onAllowanceChange).toHaveBeenCalledWith('30')

    fireEvent.change(screen.getByLabelText('Employment start date'), { target: { value: '2024-04-01' } })
    expect(onStartDateChange).toHaveBeenCalledWith('2024-04-01')

    fireEvent.click(screen.getByText('All at once'))
    expect(onAccrualModeChange).toHaveBeenCalledWith('immediate')

    fireEvent.click(screen.getByText('Gradually'))
    expect(onAccrualModeChange).toHaveBeenCalledWith('gradual')

    expect(screen.getByText(/Prorated from/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Done'))
    expect(screen.queryByText(/Annual allowance/)).not.toBeInTheDocument()
  })

  it('does not show the prorated note when hired before the year started', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    render(
      <HolidayPage
        used={2}
        daysOff={{}}
        allowance={24}
        onAllowanceChange={() => {}}
        startDate="2020-01-01"
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
      />
    )
    fireEvent.click(screen.getByText('Edit'))
    expect(screen.queryByText(/Prorated from/)).not.toBeInTheDocument()
  })
})
