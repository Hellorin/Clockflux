import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import LiveTimer from './LiveTimer'

describe('LiveTimer', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when not checked in', () => {
    const { container } = render(<LiveTimer isCheckedIn={false} todaySessions={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when checked in but there is no open session', () => {
    const { container } = render(<LiveTimer isCheckedIn={true} todaySessions={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the elapsed duration for an open session', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T10:00:01.000Z'))
    const sessions = [{ checkIn: '2026-01-01T10:00:00.000Z', checkOut: null }]
    render(<LiveTimer isCheckedIn={true} todaySessions={sessions} />)
    expect(screen.getByText('00:00:01')).toBeInTheDocument()
  })

  it('ticks the displayed duration forward every second', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'))
    const sessions = [{ checkIn: '2026-01-01T10:00:00.000Z', checkOut: null }]
    render(<LiveTimer isCheckedIn={true} todaySessions={sessions} />)
    expect(screen.getByText('00:00:00')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByText('00:00:02')).toBeInTheDocument()
  })

  it('does not show a negative duration when the component mounted before check-in', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'))
    const { rerender } = render(<LiveTimer isCheckedIn={false} todaySessions={[]} />)

    // Time passes while the app sits idle (not checked in) before the user checks in.
    vi.setSystemTime(new Date('2026-01-01T10:05:00.000Z'))
    const sessions = [{ checkIn: '2026-01-01T10:05:00.000Z', checkOut: null }]
    act(() => {
      rerender(<LiveTimer isCheckedIn={true} todaySessions={sessions} />)
    })

    expect(screen.getByText('00:00:00')).toBeInTheDocument()
  })
})
