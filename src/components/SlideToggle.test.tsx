import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SlideToggle from './SlideToggle'

function makeSessions() {
  return [{ checkIn: '2026-01-01T09:00:00.000Z', checkOut: null }]
}

describe('SlideToggle', () => {
  it('renders resting state and calls onCheckIn on click', () => {
    const onCheckIn = vi.fn()
    const onCheckOut = vi.fn()
    render(
      <SlideToggle isCheckedIn={false} onCheckIn={onCheckIn} onCheckOut={onCheckOut} todaySessions={[]} isTodayOff={false} />
    )
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggle)
    expect(onCheckIn).toHaveBeenCalledTimes(1)
    expect(onCheckOut).not.toHaveBeenCalled()
  })

  it('renders working state and calls onCheckOut on click', () => {
    const onCheckIn = vi.fn()
    const onCheckOut = vi.fn()
    const sessions = makeSessions()
    render(
      <SlideToggle isCheckedIn={true} onCheckIn={onCheckIn} onCheckOut={onCheckOut} todaySessions={sessions} isTodayOff={false} />
    )
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle)
    expect(onCheckOut).toHaveBeenCalledTimes(1)
  })

  it('shows the last check-in time when resting after a session', () => {
    const sessions = [{ checkIn: '2026-01-01T09:00:00.000Z', checkOut: '2026-01-01T12:00:00.000Z' }]
    render(
      <SlideToggle isCheckedIn={false} onCheckIn={() => {}} onCheckOut={() => {}} todaySessions={sessions} isTodayOff={false} />
    )
    expect(screen.getByText('Checked out at')).toBeInTheDocument()
  })

  it('is disabled and does not toggle when today is off and not checked in', () => {
    const onCheckIn = vi.fn()
    render(
      <SlideToggle isCheckedIn={false} onCheckIn={onCheckIn} onCheckOut={() => {}} todaySessions={[]} isTodayOff={true} />
    )
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-disabled', 'true')
    expect(toggle).toHaveAttribute('tabIndex', '-1')
    fireEvent.click(toggle)
    expect(onCheckIn).not.toHaveBeenCalled()
  })

  it('toggles on Enter and Space key presses', () => {
    const onCheckIn = vi.fn()
    render(
      <SlideToggle isCheckedIn={false} onCheckIn={onCheckIn} onCheckOut={() => {}} todaySessions={[]} isTodayOff={false} />
    )
    const toggle = screen.getByRole('switch')
    fireEvent.keyDown(toggle, { key: 'Enter' })
    expect(onCheckIn).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(toggle, { key: ' ' })
    expect(onCheckIn).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(toggle, { key: 'Tab' })
    expect(onCheckIn).toHaveBeenCalledTimes(2)
  })

  it('treats a touch drag past the midpoint as a toggle and suppresses the following click', () => {
    const onCheckIn = vi.fn()
    render(
      <SlideToggle isCheckedIn={false} onCheckIn={onCheckIn} onCheckOut={() => {}} todaySessions={[]} isTodayOff={false} />
    )
    const toggle = screen.getByRole('switch')
    fireEvent.touchStart(toggle, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchMove(toggle, { touches: [{ clientX: 100, clientY: 0 }] })
    fireEvent.touchEnd(toggle)
    expect(onCheckIn).toHaveBeenCalledTimes(1)
    // the synthetic click following a touch drag should be suppressed
    fireEvent.click(toggle)
    expect(onCheckIn).toHaveBeenCalledTimes(1)
  })

  it('treats a small touch movement as a tap, not a drag', () => {
    const onCheckIn = vi.fn()
    render(
      <SlideToggle isCheckedIn={false} onCheckIn={onCheckIn} onCheckOut={() => {}} todaySessions={[]} isTodayOff={false} />
    )
    const toggle = screen.getByRole('switch')
    fireEvent.touchStart(toggle, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchMove(toggle, { touches: [{ clientX: 1, clientY: 0 }] })
    fireEvent.touchEnd(toggle)
    expect(onCheckIn).not.toHaveBeenCalled()
    fireEvent.click(toggle)
    expect(onCheckIn).toHaveBeenCalledTimes(1)
  })

  it('ignores touch handlers while disabled', () => {
    const onCheckIn = vi.fn()
    render(
      <SlideToggle isCheckedIn={false} onCheckIn={onCheckIn} onCheckOut={() => {}} todaySessions={[]} isTodayOff={true} />
    )
    const toggle = screen.getByRole('switch')
    fireEvent.touchStart(toggle, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchMove(toggle, { touches: [{ clientX: 100, clientY: 0 }] })
    fireEvent.touchEnd(toggle)
    expect(onCheckIn).not.toHaveBeenCalled()
  })
})
