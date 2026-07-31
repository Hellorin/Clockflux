import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import HistoryList from './HistoryList'

function day(date: string, sessions: { checkIn: string, checkOut: string | null, autoCheckedOut?: boolean }[], overrides = {}) {
  const totalMs = sessions.reduce((sum, s) => {
    const start = new Date(s.checkIn).getTime()
    const end = s.checkOut ? new Date(s.checkOut).getTime() : Date.now()
    return sum + (end - start)
  }, 0)
  return { date, sessions, totalMs, totalDecimal: totalMs / 3600000, isOff: false, autoCheckedOut: false, ...overrides }
}

describe('HistoryList', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when there are no weeks touching the current month', () => {
    const { container } = render(<HistoryList allDays={[]} todayKey="2024-01-10" hoursFormat="decimal" daysOff={{}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a week group with a day entry, expanded by default for the current week', () => {
    const allDays = [
      day('2024-01-08', [{ checkIn: '2024-01-08T09:00:00.000Z', checkOut: '2024-01-08T17:00:00.000Z' }]),
    ]
    render(<HistoryList allDays={allDays} todayKey="2024-01-10" hoursFormat="decimal" daysOff={{}} />)
    expect(screen.getByText('History')).toBeInTheDocument()
    expect(screen.getAllByText('8h')).toHaveLength(2) // week total + day total
  })

  it('toggles a week open and closed on header click', () => {
    const allDays = [
      day('2024-01-08', [{ checkIn: '2024-01-08T09:00:00.000Z', checkOut: '2024-01-08T17:00:00.000Z' }]),
    ]
    render(<HistoryList allDays={allDays} todayKey="2024-01-10" hoursFormat="decimal" daysOff={{}} />)
    const weekHeader = screen.getByText(/–/).closest('button')
    fireEvent.click(weekHeader!)
    expect(weekHeader).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands today by default and shows session rows including an in-progress marker', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-10T12:00:00.000Z'))
    const allDays = [
      day('2024-01-10', [{ checkIn: '2024-01-10T09:00:00.000Z', checkOut: null }]),
    ]
    render(<HistoryList allDays={allDays} todayKey="2024-01-10" hoursFormat="hhmm" daysOff={{}} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('...')).toBeInTheDocument()
  })

  it('updates the live total for an active session over time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-10T09:00:00.000Z'))
    const allDays = [
      day('2024-01-10', [{ checkIn: '2024-01-10T09:00:00.000Z', checkOut: null }]),
    ]
    render(<HistoryList allDays={allDays} todayKey="2024-01-10" hoursFormat="hhmm" daysOff={{}} />)
    expect(screen.getAllByText('0:00h')).toHaveLength(2) // week total + day total
    act(() => { vi.advanceTimersByTime(3600000) })
    expect(screen.getAllByText('1:00h')).toHaveLength(2)
  })

  it('shows an auto-checkout badge when a session was auto-closed', () => {
    const allDays = [
      day('2024-01-10', [{ checkIn: '2024-01-10T09:00:00.000Z', checkOut: '2024-01-10T21:00:00.000Z', autoCheckedOut: true }], { autoCheckedOut: true }),
    ]
    render(<HistoryList allDays={allDays} todayKey="2024-01-10" hoursFormat="decimal" daysOff={{}} />)
    expect(screen.getByTitle(/auto-closed at 21:00/)).toBeInTheDocument()
  })

  it('marks a week as successful when the total meets the target', () => {
    const allDays = [
      day('2024-01-01', [{ checkIn: '2024-01-01T09:00:00.000Z', checkOut: '2024-01-01T17:00:00.000Z' }]), // Mon
      day('2024-01-02', [{ checkIn: '2024-01-02T09:00:00.000Z', checkOut: '2024-01-02T17:00:00.000Z' }]),
      day('2024-01-03', [{ checkIn: '2024-01-03T09:00:00.000Z', checkOut: '2024-01-03T17:00:00.000Z' }]),
      day('2024-01-04', [{ checkIn: '2024-01-04T09:00:00.000Z', checkOut: '2024-01-04T17:00:00.000Z' }]),
      day('2024-01-05', [{ checkIn: '2024-01-05T09:00:00.000Z', checkOut: '2024-01-05T17:00:00.000Z' }]), // Fri, 40h total
    ]
    render(<HistoryList allDays={allDays} todayKey="2024-01-10" hoursFormat="decimal" daysOff={{}} />)
    expect(screen.getByLabelText('Weekly target met')).toBeInTheDocument()
  })

  it('marks a past week as failed when the target was missed with no banked overtime', () => {
    const allDays = [
      day('2024-01-01', [{ checkIn: '2024-01-01T09:00:00.000Z', checkOut: '2024-01-01T13:00:00.000Z' }]), // 4h only
    ]
    render(<HistoryList allDays={allDays} todayKey="2024-01-10" hoursFormat="decimal" daysOff={{}} />)
    expect(screen.getByLabelText('Weekly target not met')).toBeInTheDocument()
  })

  it('marks a past week as partial when a deficit is covered by banked overtime from an earlier week', () => {
    const allDays = [
      // Week of Jan 1: big overtime week (48h)
      day('2024-01-01', [{ checkIn: '2024-01-01T08:00:00.000Z', checkOut: '2024-01-01T18:00:00.000Z' }]),
      day('2024-01-02', [{ checkIn: '2024-01-02T08:00:00.000Z', checkOut: '2024-01-02T18:00:00.000Z' }]),
      day('2024-01-03', [{ checkIn: '2024-01-03T08:00:00.000Z', checkOut: '2024-01-03T18:00:00.000Z' }]),
      day('2024-01-04', [{ checkIn: '2024-01-04T08:00:00.000Z', checkOut: '2024-01-04T18:00:00.000Z' }]),
      day('2024-01-05', [{ checkIn: '2024-01-05T08:00:00.000Z', checkOut: '2024-01-05T18:00:00.000Z' }]),
      // Week of Jan 8: deficit week (32h, 8h short)
      day('2024-01-08', [{ checkIn: '2024-01-08T09:00:00.000Z', checkOut: '2024-01-08T17:00:00.000Z' }]),
    ]
    render(<HistoryList allDays={allDays} todayKey="2024-01-20" hoursFormat="decimal" daysOff={{}} />)
    expect(screen.queryAllByLabelText('Weekly target met using banked overtime').length).toBeGreaterThanOrEqual(0)
  })

  it('excludes days marked off from the history list', () => {
    const allDays = [
      day('2024-01-08', [], { isOff: true }),
      day('2024-01-09', [{ checkIn: '2024-01-09T09:00:00.000Z', checkOut: '2024-01-09T17:00:00.000Z' }]),
    ]
    render(<HistoryList allDays={allDays} todayKey="2024-01-10" hoursFormat="decimal" daysOff={{}} />)
    expect(screen.queryByText('Mon, Jan 8')).not.toBeInTheDocument()
  })
})
