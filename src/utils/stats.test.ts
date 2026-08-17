import { describe, it, expect } from 'vitest'
import { computeGlobalStats, buildWeeklyTotals, computeRecentWeeklyAvg } from './stats'
import type { DaysOffMap } from '../types'

describe('computeGlobalStats', () => {
  it('returns isEmpty when there are no logged days', () => {
    expect(computeGlobalStats({}, {})).toEqual({
      isEmpty: true,
      totals: null,
      averages: null,
      streaks: null,
      charts: null,
    })
  })

  it('aggregates totals across logged workdays', () => {
    const days = {
      '2024-01-08': [{ checkIn: '2024-01-08T09:00:00', checkOut: '2024-01-08T17:00:00' }], // 8h
      '2024-01-09': [{ checkIn: '2024-01-09T09:00:00', checkOut: '2024-01-09T13:00:00' }], // 4h
    }
    const result = computeGlobalStats(days, {})
    expect(result.isEmpty).toBe(false)
    expect(result.totals!.totalHours).toBe(12)
    expect(result.totals!.workdaysLogged).toBe(2)
    expect(result.averages!.avgHoursPerWorkday).toBe(6)
  })

  it('excludes days marked fully off from totals', () => {
    const days = {
      '2024-01-08': [{ checkIn: '2024-01-08T09:00:00', checkOut: '2024-01-08T17:00:00' }],
    }
    const daysOff: DaysOffMap = { '2024-01-08': 'personal' }
    const result = computeGlobalStats(days, daysOff)
    expect(result.totals!.totalHours).toBe(0)
    expect(result.totals!.workdaysLogged).toBe(0)
  })
})

describe('buildWeeklyTotals', () => {
  it('returns one bucket per week spanning the logged range', () => {
    const perDay = [
      { key: '2024-01-08', totalMs: 8 * 3600000 },
      { key: '2024-01-15', totalMs: 4 * 3600000 },
    ]
    const weeks = buildWeeklyTotals(perDay, {})
    expect(weeks).toHaveLength(2)
    expect(weeks[0].hours).toBe(8)
    expect(weeks[0].target).toBe(40)
    expect(weeks[1].hours).toBe(4)
  })

  it('returns an empty array with no logged days', () => {
    expect(buildWeeklyTotals([], {})).toEqual([])
  })

  it("prorates the target against the user's own daily target, not a hardcoded 8h", () => {
    // The Pro "custom-daily-target" feature was ignored here entirely, so a
    // user on a 6h day was still graded against a 40h week on the Health page
    // while the Track tab correctly showed them done at 30h.
    const perDay = [{ key: '2024-01-08', totalMs: 6 * 3600000 }]
    expect(buildWeeklyTotals(perDay, {}, 6)[0].target).toBe(30)
  })

  it('still prorates a custom target for days off', () => {
    const perDay = [{ key: '2024-01-08', totalMs: 6 * 3600000 }]
    const weeks = buildWeeklyTotals(perDay, { '2024-01-09': 'personal' }, 6)
    expect(weeks[0].target).toBe(24) // (5 - 1) * 6
  })
})

describe('computeRecentWeeklyAvg', () => {
  it('reports empty status when there are no logged days', () => {
    const result = computeRecentWeeklyAvg({}, {})
    expect(result.status).toBe('empty')
    expect(result.weekCount).toBe(0)
  })
})
