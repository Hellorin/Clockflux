import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import CalendarView from './CalendarView'
import type { DayOffType } from '../types'

function day(date: string, sessions: { checkIn: string, checkOut: string }[], overrides = {}) {
  const totalMs = sessions.reduce((sum, s) => new Date(s.checkOut).getTime() - new Date(s.checkIn).getTime() + sum, 0)
  return { date, sessions, totalMs, totalDecimal: totalMs / 3600000, isOff: false, autoCheckedOut: false, ...overrides }
}

describe('CalendarView', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders the current month label and day-of-week headers', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    render(<CalendarView allDays={[]} onDayClick={() => {}} />)
    expect(screen.getByText('June 2024')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Week')).toBeInTheDocument()
  })

  it('navigates to the previous and next month, wrapping across year boundaries', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    render(<CalendarView allDays={[]} onDayClick={() => {}} />)
    expect(screen.getByText('January 2024')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Previous month'))
    expect(screen.getByText('December 2023')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Next month'))
    fireEvent.click(screen.getByLabelText('Next month'))
    expect(screen.getByText('February 2024')).toBeInTheDocument()
  })

  it('calls onDayClick with day data when a day cell is clicked', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const allDays = [day('2024-01-10', [{ checkIn: '2024-01-10T09:00:00.000Z', checkOut: '2024-01-10T17:00:00.000Z' }])]
    const onDayClick = vi.fn()
    const { container } = render(<CalendarView allDays={allDays} onDayClick={onDayClick} />)
    const cell = Array.from(container.querySelectorAll('.cal-day')).find(el => el.textContent!.startsWith('10'))!
    fireEvent.click(cell!)
    expect(onDayClick).toHaveBeenCalledWith('2024-01-10', expect.objectContaining({ date: '2024-01-10' }))
  })

  it('calls onDayClick with null day data for an empty day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const onDayClick = vi.fn()
    const { container } = render(<CalendarView allDays={[]} onDayClick={onDayClick} />)
    const cell = Array.from(container.querySelectorAll('.cal-day')).find(el => el.textContent!.startsWith('10'))!
    fireEvent.click(cell!)
    expect(onDayClick).toHaveBeenCalledWith('2024-01-10', null)
  })

  it('shows a day-off badge for a marked day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const { container } = render(<CalendarView allDays={[]} onDayClick={() => {}} daysOff={{ '2024-01-10': 'sick' }} />)
    const cell = Array.from(container.querySelectorAll('.cal-day')).find(el => el.textContent!.startsWith('10'))!
    expect(cell.querySelector('.cal-day-off-badge')).not.toBeNull()
    expect(cell.className).toContain('cal-day--day-off')
  })

  it('shows an unknown day-off badge fallback for an unrecognized kind', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const { container } = render(<CalendarView allDays={[]} onDayClick={() => {}} daysOff={{ '2024-01-10': 'bogus' as DayOffType }} />)
    const cell = Array.from(container.querySelectorAll('.cal-day')).find(el => el.textContent!.startsWith('10'))!
    expect(cell.querySelector('.cal-day-off-badge')!.textContent).toBe('❓')
  })

  it('shows an auto-checkout warning icon for auto-closed sessions', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const allDays = [day('2024-01-10', [{ checkIn: '2024-01-10T09:00:00.000Z', checkOut: '2024-01-10T21:00:00.000Z' }], { autoCheckedOut: true })]
    const { container } = render(<CalendarView allDays={allDays} onDayClick={() => {}} />)
    const cell = Array.from(container.querySelectorAll('.cal-day')).find(el => el.textContent!.startsWith('10'))!
    expect(cell.querySelector('.cal-day-warn')).not.toBeNull()
  })

  it('shows a tooltip with hours and session count on hover', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const allDays = [day('2024-01-10', [{ checkIn: '2024-01-10T09:00:00.000Z', checkOut: '2024-01-10T17:00:00.000Z' }])]
    const { container } = render(<CalendarView allDays={allDays} onDayClick={() => {}} />)
    const cell = Array.from(container.querySelectorAll('.cal-day')).find(el => el.textContent!.startsWith('10'))!
    fireEvent.mouseEnter(cell)
    expect(container.querySelector('.cal-day-tooltip')).not.toBeNull()
    fireEvent.mouseLeave(cell)
    expect(container.querySelector('.cal-day-tooltip')).toBeNull()
  })

  it('handles a left swipe to advance and a right swipe to go back a month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const { container } = render(<CalendarView allDays={[]} onDayClick={() => {}} />)
    const grid = container.querySelector('.cal-grid')!
    fireEvent.touchStart(grid, { touches: [{ clientX: 200, clientY: 0 }] })
    fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 100, clientY: 0 }] })
    expect(screen.getByText('February 2024')).toBeInTheDocument()

    fireEvent.touchStart(grid, { touches: [{ clientX: 100, clientY: 0 }] })
    fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 200, clientY: 0 }] })
    expect(screen.getByText('January 2024')).toBeInTheDocument()
  })

  it('ignores small or vertical swipes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const { container } = render(<CalendarView allDays={[]} onDayClick={() => {}} />)
    const grid = container.querySelector('.cal-grid')!
    fireEvent.touchStart(grid, { touches: [{ clientX: 100, clientY: 0 }] })
    fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 110, clientY: 0 }] })
    expect(screen.getByText('January 2024')).toBeInTheDocument()

    fireEvent.touchStart(grid, { touches: [{ clientX: 100, clientY: 0 }] })
    fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 200, clientY: 200 }] })
    expect(screen.getByText('January 2024')).toBeInTheDocument()
  })

  it('ignores touchend with no matching touchstart', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const { container } = render(<CalendarView allDays={[]} onDayClick={() => {}} />)
    const grid = container.querySelector('.cal-grid')!
    fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 200, clientY: 0 }] })
    expect(screen.getByText('January 2024')).toBeInTheDocument()
  })

  it('enters select mode, selects days, and applies a bulk day-off type', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const onBulkSetDaysOffType = vi.fn()
    const { container } = render(<CalendarView allDays={[]} onDayClick={() => {}} onBulkSetDaysOffType={onBulkSetDaysOffType} />)
    fireEvent.click(screen.getByText('Select'))
    expect(screen.getByText('Cancel')).toBeInTheDocument()

    const cell10 = Array.from(container.querySelectorAll('.cal-day')).find(el => el.textContent!.startsWith('10'))!
    fireEvent.click(cell10)
    expect(screen.getByText('1 day selected')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Personal'))
    expect(onBulkSetDaysOffType).toHaveBeenCalledWith(['2024-01-10'], 'personal')
    // selection mode exits and clears after applying
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
  })

  it('does not select weekend days while in select mode', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const { container } = render(<CalendarView allDays={[]} onDayClick={() => {}} />)
    fireEvent.click(screen.getByText('Select'))
    // Jan 13, 2024 is a Saturday
    const cell13 = Array.from(container.querySelectorAll('.cal-day')).find(el => el.textContent!.startsWith('13'))!
    fireEvent.click(cell13)
    expect(screen.getByText('0 days selected')).toBeInTheDocument()
  })

  it('clears the bulk selection via the Clear button', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const onBulkSetDaysOffType = vi.fn()
    const { container } = render(<CalendarView allDays={[]} onDayClick={() => {}} onBulkSetDaysOffType={onBulkSetDaysOffType} />)
    fireEvent.click(screen.getByText('Select'))
    const cell10 = Array.from(container.querySelectorAll('.cal-day')).find(el => el.textContent!.startsWith('10'))!
    fireEvent.click(cell10)
    fireEvent.click(screen.getByText('Clear'))
    expect(onBulkSetDaysOffType).toHaveBeenCalledWith(['2024-01-10'], null)
  })

  it('toggles the half-day option for bulk actions', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const onBulkSetDaysOffType = vi.fn()
    const { container } = render(<CalendarView allDays={[]} onDayClick={() => {}} onBulkSetDaysOffType={onBulkSetDaysOffType} />)
    fireEvent.click(screen.getByText('Select'))
    const cell10 = Array.from(container.querySelectorAll('.cal-day')).find(el => el.textContent!.startsWith('10'))!
    fireEvent.click(cell10)
    fireEvent.click(screen.getByTitle('Apply as half day'))
    fireEvent.click(screen.getByText('Personal'))
    expect(onBulkSetDaysOffType).toHaveBeenCalledWith(['2024-01-10'], 'personal-half')
  })

  it('cancels select mode via the Cancel button, clearing selection', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const { container } = render(<CalendarView allDays={[]} onDayClick={() => {}} />)
    fireEvent.click(screen.getByText('Select'))
    const cell10 = Array.from(container.querySelectorAll('.cal-day')).find(el => el.textContent!.startsWith('10'))!
    fireEvent.click(cell10)
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.getByText('Select')).toBeInTheDocument()
  })

  it('shows a colored week total once sessions exist and a placeholder otherwise', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    const allDays = [day('2024-01-08', [{ checkIn: '2024-01-08T09:00:00.000Z', checkOut: '2024-01-08T17:00:00.000Z' }])]
    const { container } = render(<CalendarView allDays={allDays} onDayClick={() => {}} />)
    expect(container.querySelectorAll('.cal-week-empty').length).toBeGreaterThan(0)
    expect(screen.getByText('8.0h')).toBeInTheDocument()
  })

  describe('pro range export', () => {
    it('is hidden when none of the export-csv/pdf/ics features are enabled', () => {
      render(<CalendarView allDays={[]} onDayClick={() => {}} />)
      expect(screen.queryByTitle('Export a custom date range as CSV, PDF, or ICS')).toBeNull()
    })

    it('shows the export button when only one format is enabled, with only that format offered', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      render(<CalendarView allDays={[]} onDayClick={() => {}} exportPdfEnabled onExportRange={vi.fn()} />)
      fireEvent.click(screen.getByTitle('Export a custom date range as CSV, PDF, or ICS'))
      expect(screen.getByText('PDF')).toBeInTheDocument()
      expect(screen.queryByText('CSV')).toBeNull()
      expect(screen.queryByText('ICS')).toBeNull()
    })

    it('opens the panel defaulted to the current month and requests each enabled format', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      const onExportRange = vi.fn().mockResolvedValue(true)
      render(<CalendarView allDays={[]} onDayClick={() => {}} exportCsvEnabled exportPdfEnabled exportIcsEnabled onExportRange={onExportRange} />)

      fireEvent.click(screen.getByTitle('Export a custom date range as CSV, PDF, or ICS'))
      expect(screen.getByLabelText('From')).toHaveValue('2024-01-01')
      expect(screen.getByLabelText('To')).toHaveValue('2024-01-31')

      fireEvent.click(screen.getByText('CSV'))
      expect(onExportRange).toHaveBeenCalledWith('csv', '2024-01-01', '2024-01-31')
    })

    it('shows an error message when the export fails', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      const onExportRange = vi.fn().mockResolvedValue(false)
      render(<CalendarView allDays={[]} onDayClick={() => {}} exportCsvEnabled exportPdfEnabled exportIcsEnabled onExportRange={onExportRange} />)

      fireEvent.click(screen.getByTitle('Export a custom date range as CSV, PDF, or ICS'))
      await act(() => fireEvent.click(screen.getByText('PDF')))
      expect(screen.getByText('Export failed. Check the date range and try again.')).toBeInTheDocument()
    })

    it('rejects an end date before the start date without calling onExportRange', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      const onExportRange = vi.fn()
      render(<CalendarView allDays={[]} onDayClick={() => {}} exportCsvEnabled exportPdfEnabled exportIcsEnabled onExportRange={onExportRange} />)

      fireEvent.click(screen.getByTitle('Export a custom date range as CSV, PDF, or ICS'))
      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2024-01-20' } })
      fireEvent.change(screen.getByLabelText('To'), { target: { value: '2024-01-10' } })
      await act(() => fireEvent.click(screen.getByText('ICS')))

      expect(onExportRange).not.toHaveBeenCalled()
      expect(screen.getByText('Export failed. Check the date range and try again.')).toBeInTheDocument()
    })

    it('closes the panel when the export button is toggled again', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      render(<CalendarView allDays={[]} onDayClick={() => {}} exportCsvEnabled onExportRange={vi.fn()} />)
      const btn = screen.getByTitle('Export a custom date range as CSV, PDF, or ICS')
      fireEvent.click(btn)
      expect(screen.getByLabelText('From')).toBeInTheDocument()
      fireEvent.click(btn)
      expect(screen.queryByLabelText('From')).toBeNull()
    })
  })
})
