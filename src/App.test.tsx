import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from './App'
import { mountLandingFixture } from './test/landingFixture'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-10T12:00:00.000Z')) // Wednesday
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the tracker view by default', () => {
    render(<App />)
    expect(screen.getByText('Clockflux')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('navigates between tabs', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Calendar'))
    expect(screen.getByText('Week')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Holiday'))
    expect(screen.getByText('Holiday balance')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Health'))
    expect(screen.getByText('No data yet')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Track')).toString()
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('checks in via the slide toggle and sets the light theme', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('switch'))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('toggles the hours display format and persists the choice', () => {
    localStorage.setItem('timeforge', JSON.stringify({
      days: { '2024-01-10': [{ checkIn: '2024-01-10T09:00:00.000Z', checkOut: '2024-01-10T13:00:00.000Z' }] },
      daysOff: {},
    }))
    render(<App />)
    const toggleBtn = screen.getByTitle('Toggle hours format')
    fireEvent.click(toggleBtn)
    expect(localStorage.getItem('hoursFormat')).toBe('hhmm')
  })

  it('opens the day edit modal from the calendar and saves sessions', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Calendar'))
    const cell = Array.from(document.querySelectorAll('.cal-day')).find(el => el.textContent.startsWith('10'))
    fireEvent.click(cell!)
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Save'))
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument()
  })

  it('closes the day edit modal without saving', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Calendar'))
    const cell = Array.from(document.querySelectorAll('.cal-day')).find(el => el.textContent.startsWith('10'))
    fireEvent.click(cell!)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument()
  })

  it('shows the celebration overlay when a daily milestone is crossed', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('switch')) // check in
    vi.advanceTimersByTime(8 * 3600000 + 60000)
    fireEvent.click(screen.getByRole('switch')) // check out, crossing 8h
    expect(screen.getByText('Daily goal smashed!')).toBeInTheDocument()
  })

  describe('landing page', () => {
    it('re-opens the landing from the header and makes the app inert', () => {
      const landing = mountLandingFixture()
      document.documentElement.dataset.landing = 'hidden'
      render(<App />)

      fireEvent.click(screen.getByLabelText('About Clockflux'))
      expect(document.documentElement.dataset.landing).toBe('visible')
      expect(document.querySelector('.app')).toHaveAttribute('inert')

      fireEvent.click(landing.querySelector('[data-landing-dismiss]')!)
      expect(document.documentElement.dataset.landing).toBe('hidden')
      expect(document.querySelector('.app')).not.toHaveAttribute('inert')
    })
  })
})
