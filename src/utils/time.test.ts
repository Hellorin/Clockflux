import { describe, it, expect } from 'vitest'
import {
  toDecimalHours,
  sumSessionsMs,
  toHoursMinutes,
  decimalToHoursMinutes,
  formatDuration,
  formatDateKey,
  isWeekend,
  getWeekDays,
  computeWeekProgress,
  getTodayKey,
} from './time'
import type { DaysOffMap } from '../types'

describe('toDecimalHours', () => {
  it('rounds to the nearest quarter hour', () => {
    expect(toDecimalHours(8 * 3600000 + 15 * 60000)).toBe(8.25)
    expect(toDecimalHours(8 * 3600000 + 30 * 60000)).toBe(8.5)
    expect(toDecimalHours(8 * 3600000 + 44 * 60000)).toBe(8.75)
  })
})

describe('sumSessionsMs', () => {
  it('sums closed sessions', () => {
    const sessions = [
      { checkIn: '2026-01-01T09:00:00.000Z', checkOut: '2026-01-01T12:00:00.000Z' },
      { checkIn: '2026-01-01T13:00:00.000Z', checkOut: '2026-01-01T17:00:00.000Z' },
    ]
    expect(sumSessionsMs(sessions)).toBe(7 * 3600000)
  })

  it('counts an open session up to `now`', () => {
    const sessions = [{ checkIn: '2026-01-01T09:00:00.000Z', checkOut: null }]
    const now = new Date('2026-01-01T11:00:00.000Z').getTime()
    expect(sumSessionsMs(sessions, now)).toBe(2 * 3600000)
  })
})

describe('toHoursMinutes / decimalToHoursMinutes', () => {
  it('formats ms as H:MM', () => {
    expect(toHoursMinutes(8 * 3600000 + 15 * 60000)).toBe('8:15')
  })

  it('formats decimal hours as H:MM', () => {
    expect(decimalToHoursMinutes(8.25)).toBe('8:15')
  })
})

describe('formatDuration', () => {
  it('formats ms as HH:MM:SS', () => {
    expect(formatDuration(3661000)).toBe('01:01:01')
  })
})

describe('formatDateKey', () => {
  it('includes the year and does not throw', () => {
    expect(formatDateKey('2026-03-03')).toContain('2026')
  })
})

describe('isWeekend', () => {
  it('flags Saturday and Sunday', () => {
    expect(isWeekend('2024-01-06')).toBe(true) // Saturday
    expect(isWeekend('2024-01-07')).toBe(true) // Sunday
  })

  it('does not flag weekdays', () => {
    expect(isWeekend('2024-01-08')).toBe(false) // Monday
  })
})

describe('getWeekDays', () => {
  it('returns Monday through Sunday for the reference date', () => {
    const days = getWeekDays(new Date('2024-01-10T12:00:00')) // Wednesday
    expect(days).toHaveLength(7)
    expect(days[0].getDay()).toBe(1) // Monday
    expect(days[6].getDay()).toBe(0) // Sunday
  })
})

describe('computeWeekProgress', () => {
  it('computes totals and target excluding full days off', () => {
    const weekDays = getWeekDays(new Date('2024-01-10T12:00:00')) // week of Jan 8-14, 2024
    const days = {
      '2024-01-08': [{ checkIn: '2024-01-08T09:00:00', checkOut: '2024-01-08T17:00:00' }], // 8h
    }
    const daysOff: DaysOffMap = { '2024-01-09': 'personal' } // full day off, excluded from target
    const result = computeWeekProgress(weekDays, days, daysOff)
    expect(result.weekTotal).toBe(8)
    expect(result.weekTarget).toBe(32) // (5 - 1) * 8
  })
})

describe('getTodayKey', () => {
  it('returns a YYYY-MM-DD key', () => {
    expect(getTodayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
