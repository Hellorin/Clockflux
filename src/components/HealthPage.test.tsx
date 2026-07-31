import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import HealthPage from './HealthPage'
import { computeGlobalStats } from '../utils/stats'
import type { GlobalStats } from '../utils/stats'
import type { DayEntry } from '../hooks/useTimeTracker'

function makeDays(): Record<string, { checkIn: string, checkOut: string }[]> {
  const days: Record<string, { checkIn: string, checkOut: string }[]> = {}
  // Four consecutive Mon-Fri weeks with an 8h/day, meeting target -> "ok" status
  const weeks = ['2024-01-01', '2024-01-08', '2024-01-15', '2024-01-22']
  for (const monday of weeks) {
    const [y, m, d] = monday.split('-').map(Number)
    for (let i = 0; i < 5; i++) {
      const date = new Date(y, m - 1, d + i)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      days[key] = [{ checkIn: `${key}T09:00:00.000`, checkOut: `${key}T17:00:00.000` }]
    }
  }
  return days
}

describe('HealthPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the empty state when stats are empty', () => {
    render(<HealthPage stats={{ isEmpty: true } as GlobalStats} allDays={[]} daysOff={{}} employmentStartDate={null} />)
    expect(screen.getByText('No data yet')).toBeInTheDocument()
  })

  it('shows the empty state when stats is null', () => {
    render(<HealthPage stats={null} allDays={[]} daysOff={{}} employmentStartDate={null} />)
    expect(screen.getByText('No data yet')).toBeInTheDocument()
  })

  it('renders health metrics and week breakdown for a healthy history', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-02-05T12:00:00'))
    const days = makeDays()
    const daysOff = {}
    const allDays = Object.entries(days).map(([date, sessions]) => ({ date, sessions })) as DayEntry[]
    const stats = computeGlobalStats(days, daysOff)
    render(<HealthPage stats={stats} allDays={allDays} daysOff={daysOff} employmentStartDate="2024-01-01" />)
    expect(screen.getByText('Great, keep up the good work')).toBeInTheDocument()
    expect(screen.getByText('Daily average')).toBeInTheDocument()
    expect(screen.getByText('Cumulative overtime')).toBeInTheDocument()
    expect(screen.getByText('Recent weeks')).toBeInTheDocument()
  })

  it('opens and closes the thresholds guide popover', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-02-05T12:00:00'))
    const days = makeDays()
    const allDays = Object.entries(days).map(([date, sessions]) => ({ date, sessions })) as DayEntry[]
    const stats = computeGlobalStats(days, {})
    render(<HealthPage stats={stats} allDays={allDays} daysOff={{}} employmentStartDate={null} />)
    fireEvent.click(screen.getByLabelText('What do these thresholds mean?'))
    expect(screen.getByText('What the thresholds mean')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByText('What the thresholds mean')).not.toBeInTheDocument()
  })

  it('shows the too-much status message when overworking', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-02-05T12:00:00'))
    const days: Record<string, { checkIn: string, checkOut: string }[]> = {}
    for (const monday of ['2024-01-01', '2024-01-08', '2024-01-15', '2024-01-22']) {
      const [y, m, d] = monday.split('-').map(Number)
      for (let i = 0; i < 5; i++) {
        const date = new Date(y, m - 1, d + i)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        days[key] = [{ checkIn: `${key}T08:00:00.000`, checkOut: `${key}T20:00:00.000` }] // 12h/day
      }
    }
    const allDays = Object.entries(days).map(([date, sessions]) => ({ date, sessions })) as DayEntry[]
    const stats = computeGlobalStats(days, {})
    render(<HealthPage stats={stats} allDays={allDays} daysOff={{}} employmentStartDate={null} />)
    expect(screen.getByText('Take it easy, this is about your health')).toBeInTheDocument()
  })

  it('shows the no-data status message when there are no completed weeks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-03T12:00:00'))
    const days = { '2024-01-01': [{ checkIn: '2024-01-01T09:00:00.000', checkOut: '2024-01-01T17:00:00.000' }] }
    const allDays = Object.entries(days).map(([date, sessions]) => ({ date, sessions })) as DayEntry[]
    const stats = computeGlobalStats(days, {})
    render(<HealthPage stats={stats} allDays={allDays} daysOff={{}} employmentStartDate={null} />)
    expect(screen.getByText('Keep tracking — your health score will appear after your first full week')).toBeInTheDocument()
    expect(screen.getByText('Based on your overall daily average')).toBeInTheDocument()
  })
})
