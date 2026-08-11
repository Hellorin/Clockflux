import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsPage from './SettingsPage'

describe('SettingsPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates allowance, start date, and accrual mode', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    const onAllowanceChange = vi.fn()
    const onStartDateChange = vi.fn()
    const onAccrualModeChange = vi.fn()
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={onAllowanceChange}
        startDate="2024-03-01"
        onStartDateChange={onStartDateChange}
        accrualMode="gradual"
        onAccrualModeChange={onAccrualModeChange}
      />
    )

    fireEvent.click(screen.getByText('Holiday'))

    fireEvent.change(screen.getByLabelText('Annual holiday allowance'), { target: { value: '30' } })
    expect(onAllowanceChange).toHaveBeenCalledWith('30')

    fireEvent.change(screen.getByLabelText('Employment start date'), { target: { value: '2024-04-01' } })
    expect(onStartDateChange).toHaveBeenCalledWith('2024-04-01')

    fireEvent.click(screen.getByText('All at once'))
    expect(onAccrualModeChange).toHaveBeenCalledWith('immediate')

    fireEvent.click(screen.getByText('Gradually'))
    expect(onAccrualModeChange).toHaveBeenCalledWith('gradual')

    expect(screen.getByText(/Prorated from/)).toBeInTheDocument()
  })

  it('does not show the prorated note when hired before the year started', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate="2020-01-01"
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
      />
    )
    fireEvent.click(screen.getByText('Holiday'))
    expect(screen.queryByText(/Prorated from/)).not.toBeInTheDocument()
  })
})
