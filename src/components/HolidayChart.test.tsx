import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import HolidayChart from './HolidayChart'

describe('HolidayChart', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders an svg covering the full year when no start date is given', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    const { container } = render(
      <HolidayChart daysOff={{}} allowance={25} startDate={null} accrualMode="gradual" />
    )
    const svg = container.querySelector('svg.holiday-chart')
    expect(svg).not.toBeNull()
    expect(container.querySelectorAll('.holiday-chart__month-label')).toHaveLength(12)
  })

  it('starts the chart from the employment start month within the current year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    const { container } = render(
      <HolidayChart daysOff={{}} allowance={25} startDate="2024-04-01" accrualMode="gradual" />
    )
    expect(container.querySelectorAll('.holiday-chart__month-label')).toHaveLength(9) // Apr..Dec
  })

  it('renders used/earned polylines reflecting personal days off', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    const { container } = render(
      <HolidayChart
        daysOff={{ '2024-03-01': 'personal', '2024-03-02': 'sick' }}
        allowance={25}
        startDate={null}
        accrualMode="gradual"
      />
    )
    expect(container.querySelector('.holiday-chart__used-line')).not.toBeNull()
    expect(container.querySelector('.holiday-chart__earned')).not.toBeNull()
  })

  it('supports immediate accrual mode', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    const { container } = render(
      <HolidayChart daysOff={{}} allowance={25} startDate="2024-01-01" accrualMode="immediate" />
    )
    expect(container.querySelector('svg.holiday-chart')).not.toBeNull()
  })

  it('ignores a startDate from a different year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    const { container } = render(
      <HolidayChart daysOff={{}} allowance={25} startDate="2023-04-01" accrualMode="gradual" />
    )
    expect(container.querySelectorAll('.holiday-chart__month-label')).toHaveLength(12)
  })
})
