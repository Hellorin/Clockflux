import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TodaySummary from './TodaySummary'

describe('TodaySummary', () => {
  it('renders nothing when there is no daily or weekly data to show', () => {
    const { container } = render(
      <TodaySummary
        todaySessions={[]}
        hoursFormat="decimal"
        onToggleFormat={() => {}}
        isTodayOff={true}
        todayTargetMs={0}
        weekTargetMs={0}
        weekTotalOtherDaysMs={0}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the decimal daily total and session count', () => {
    const sessions = [
      { checkIn: '2026-01-01T09:00:00.000Z', checkOut: '2026-01-01T13:00:00.000Z' },
    ]
    render(
      <TodaySummary
        todaySessions={sessions}
        hoursFormat="decimal"
        onToggleFormat={() => {}}
        isTodayOff={false}
        todayTargetMs={8 * 3600000}
        weekTargetMs={0}
        weekTotalOtherDaysMs={0}
      />
    )
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText(/1 session/)).toBeInTheDocument()
  })

  it('shows the hh:mm daily total when hoursFormat is hhmm', () => {
    const sessions = [
      { checkIn: '2026-01-01T09:00:00.000Z', checkOut: '2026-01-01T13:00:00.000Z' },
      { checkIn: '2026-01-01T14:00:00.000Z', checkOut: '2026-01-01T15:00:00.000Z' },
    ]
    render(
      <TodaySummary
        todaySessions={sessions}
        hoursFormat="hhmm"
        onToggleFormat={() => {}}
        isTodayOff={false}
        todayTargetMs={8 * 3600000}
        weekTargetMs={0}
        weekTotalOtherDaysMs={0}
      />
    )
    expect(screen.getByText('5:00')).toBeInTheDocument()
    expect(screen.getByText(/2 sessions/)).toBeInTheDocument()
  })

  it('calls onToggleFormat when the format toggle button is clicked', async () => {
    const onToggleFormat = vi.fn()
    const sessions = [{ checkIn: '2026-01-01T09:00:00.000Z', checkOut: '2026-01-01T13:00:00.000Z' }]
    const { user } = renderWithUser(
      <TodaySummary
        todaySessions={sessions}
        hoursFormat="decimal"
        onToggleFormat={onToggleFormat}
        isTodayOff={false}
        todayTargetMs={8 * 3600000}
        weekTargetMs={0}
        weekTotalOtherDaysMs={0}
      />
    )
    await user.click(screen.getByTitle('Toggle hours format'))
    expect(onToggleFormat).toHaveBeenCalledTimes(1)
  })

  it('shows week progress with remaining time when under target', () => {
    render(
      <TodaySummary
        todaySessions={[]}
        hoursFormat="decimal"
        onToggleFormat={() => {}}
        isTodayOff={true}
        todayTargetMs={0}
        weekTargetMs={40 * 3600000}
        weekTotalOtherDaysMs={10 * 3600000}
      />
    )
    expect(screen.getByText('left this week')).toBeInTheDocument()
  })

  it('shows "Week complete!" when the week target has been met', () => {
    render(
      <TodaySummary
        todaySessions={[]}
        hoursFormat="decimal"
        onToggleFormat={() => {}}
        isTodayOff={true}
        todayTargetMs={0}
        weekTargetMs={40 * 3600000}
        weekTotalOtherDaysMs={40 * 3600000}
      />
    )
    expect(screen.getByText('Week complete!')).toBeInTheDocument()
  })

  it('shows overtime ahead-of-pace text when over the daily target', () => {
    const sessions = [{ checkIn: '2026-01-01T09:00:00.000Z', checkOut: '2026-01-01T18:00:00.000Z' }] // 9h
    render(
      <TodaySummary
        todaySessions={sessions}
        hoursFormat="decimal"
        onToggleFormat={() => {}}
        isTodayOff={false}
        todayTargetMs={8 * 3600000}
        weekTargetMs={40 * 3600000}
        weekTotalOtherDaysMs={0}
        allPastWorkdayOvertimeMs={0}
      />
    )
    expect(screen.getByText(/overtime/)).toBeInTheDocument()
  })

  it('shows behind-pace text when under the daily target', () => {
    const sessions = [{ checkIn: '2026-01-01T09:00:00.000Z', checkOut: '2026-01-01T12:00:00.000Z' }] // 3h
    render(
      <TodaySummary
        todaySessions={sessions}
        hoursFormat="decimal"
        onToggleFormat={() => {}}
        isTodayOff={false}
        todayTargetMs={8 * 3600000}
        weekTargetMs={40 * 3600000}
        weekTotalOtherDaysMs={0}
        allPastWorkdayOvertimeMs={0}
      />
    )
    expect(screen.getByText(/behind pace/)).toBeInTheDocument()
  })
})

// Helper to get a userEvent instance bound to the render
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
function renderWithUser(ui: ReactElement) {
  const user = userEvent.setup()
  const utils = render(ui)
  return { user, ...utils }
}
