import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildDaysOffIcs, downloadIcsFile } from './icsExport'
import type { DaysOffMap } from '../types'

describe('buildDaysOffIcs', () => {
  it('includes only entries for the requested month', () => {
    const daysOff: DaysOffMap = {
      '2024-03-15': 'personal',
      '2024-04-01': 'sick',
    }
    const ics = buildDaysOffIcs(daysOff, 2024, 2) // March (0-indexed)
    expect(ics).toContain('DTSTART;VALUE=DATE:20240315')
    expect(ics).not.toContain('20240401')
  })

  it('labels half-day entries distinctly', () => {
    const ics = buildDaysOffIcs({ '2024-03-15': 'personal-half' }, 2024, 2)
    expect(ics).toContain('Day Off (Personal\\, Half Day)')
  })

  it('skips unknown day-off types', () => {
    const ics = buildDaysOffIcs({ '2024-03-15': 'not-a-real-type' } as unknown as DaysOffMap, 2024, 2)
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('rolls DTEND over to the next day, handling month-end overflow', () => {
    const ics = buildDaysOffIcs({ '2024-03-31': 'official' }, 2024, 2)
    expect(ics).toContain('DTEND;VALUE=DATE:20240401')
  })

  it('wraps content in VCALENDAR with CRLF line endings', () => {
    const ics = buildDaysOffIcs({}, 2024, 2)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('sorts entries chronologically regardless of insertion order', () => {
    const ics = buildDaysOffIcs({ '2024-03-20': 'personal', '2024-03-05': 'sick' }, 2024, 2)
    expect(ics.indexOf('20240305')).toBeLessThan(ics.indexOf('20240320'))
  })
})

describe('downloadIcsFile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a download link, clicks it, and revokes the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadIcsFile('days-off.ics', 'CONTENT')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
