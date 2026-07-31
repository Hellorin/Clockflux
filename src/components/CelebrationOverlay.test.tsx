import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import confetti from 'canvas-confetti'
import CelebrationOverlay from './CelebrationOverlay'

describe('CelebrationOverlay', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders nothing when there is no milestone', () => {
    const { container } = render(<CelebrationOverlay milestone={null} onDismiss={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the daily milestone message and fires single confetti burst', () => {
    render(<CelebrationOverlay milestone="daily" onDismiss={() => {}} />)
    expect(screen.getByText('Daily goal smashed!')).toBeInTheDocument()
    expect(screen.getByText("You've hit 8 hours today.")).toBeInTheDocument()
    expect(confetti).toHaveBeenCalledTimes(1)
  })

  it('renders the weekly milestone message and fires two confetti bursts', () => {
    render(<CelebrationOverlay milestone="weekly" onDismiss={() => {}} />)
    expect(screen.getByText('Weekly target reached!')).toBeInTheDocument()
    expect(confetti).toHaveBeenCalledTimes(2)
  })

  it('dismisses automatically after 3 seconds', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<CelebrationOverlay milestone="daily" onDismiss={onDismiss} />)
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not fire confetti twice for the same milestone across rerenders', () => {
    const { rerender } = render(<CelebrationOverlay milestone="daily" onDismiss={() => {}} />)
    expect(confetti).toHaveBeenCalledTimes(1)
    rerender(<CelebrationOverlay milestone="daily" onDismiss={() => {}} />)
    expect(confetti).toHaveBeenCalledTimes(1)
  })
})
