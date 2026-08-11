import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimeTracker } from './useTimeTracker'
import type { DayOffType } from '../types'

const WEDNESDAY = '2024-01-10T10:00:00.000Z'

function setNow(iso: string) {
  vi.setSystemTime(new Date(iso))
}

describe('useTimeTracker', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    setNow(WEDNESDAY)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with no sessions and not checked in', () => {
    const { result } = renderHook(() => useTimeTracker())
    expect(result.current.isCheckedIn).toBe(false)
    expect(result.current.todaySessions).toEqual([])
    expect(result.current.allDays).toEqual([])
  })

  it('checks in and persists to localStorage', () => {
    const { result } = renderHook(() => useTimeTracker())
    act(() => result.current.checkIn())
    expect(result.current.isCheckedIn).toBe(true)
    expect(result.current.todaySessions).toHaveLength(1)
    expect(result.current.todaySessions[0].checkOut).toBeNull()

    const stored = JSON.parse(localStorage.getItem('app')!)
    expect(stored.days[result.current.todayKey]).toHaveLength(1)
  })

  it('ignores a double check-in', () => {
    const { result } = renderHook(() => useTimeTracker())
    act(() => result.current.checkIn())
    act(() => result.current.checkIn())
    expect(result.current.todaySessions).toHaveLength(1)
  })

  it('checks out and closes the open session', () => {
    const { result } = renderHook(() => useTimeTracker())
    act(() => result.current.checkIn())
    act(() => { vi.advanceTimersByTime(3600000) }) // +1h
    act(() => result.current.checkOut())
    expect(result.current.isCheckedIn).toBe(false)
    expect(result.current.todaySessions[0].checkOut).not.toBeNull()
  })

  it('ignores checkOut when there is no open session', () => {
    const { result } = renderHook(() => useTimeTracker())
    act(() => result.current.checkOut())
    expect(result.current.todaySessions).toEqual([])
  })

  it('blocks check-in on a weekend', () => {
    setNow('2024-01-13T10:00:00.000Z') // Saturday
    const { result } = renderHook(() => useTimeTracker())
    act(() => result.current.checkIn())
    expect(result.current.isCheckedIn).toBe(false)
  })

  it('blocks check-in on a full day off', () => {
    const { result } = renderHook(() => useTimeTracker())
    act(() => result.current.setDayOffType(result.current.todayKey, 'personal'))
    act(() => result.current.checkIn())
    expect(result.current.isCheckedIn).toBe(false)
  })

  it('allows check-in on a half day off', () => {
    const { result } = renderHook(() => useTimeTracker())
    act(() => result.current.setDayOffType(result.current.todayKey, 'personal-half'))
    act(() => result.current.checkIn())
    expect(result.current.isCheckedIn).toBe(true)
    expect(result.current.isTodayOff).toBe(false)
    expect(result.current.todayTargetMs).toBe(4 * 3600000)
  })

  it('fires the daily milestone callback when crossing 8 hours', () => {
    const { result } = renderHook(() => useTimeTracker())
    const onMilestone = vi.fn()
    act(() => result.current.setMilestoneCallback(onMilestone))
    act(() => result.current.checkIn())
    act(() => { vi.advanceTimersByTime(8 * 3600000 + 60000) })
    act(() => result.current.checkOut())
    expect(onMilestone).toHaveBeenCalledWith('daily')
  })

  it('does not fire a milestone when staying under the daily target', () => {
    const { result } = renderHook(() => useTimeTracker())
    const onMilestone = vi.fn()
    act(() => result.current.setMilestoneCallback(onMilestone))
    act(() => result.current.checkIn())
    act(() => { vi.advanceTimersByTime(2 * 3600000) })
    act(() => result.current.checkOut())
    expect(onMilestone).not.toHaveBeenCalled()
  })

  it('setDaySessions replaces sessions for a date and removes empty entries', () => {
    const { result } = renderHook(() => useTimeTracker())
    const key = result.current.todayKey
    act(() => result.current.setDaySessions(key, [
      { checkIn: '2024-01-10T09:00:00.000Z', checkOut: '2024-01-10T17:00:00.000Z' },
    ]))
    expect(result.current.todaySessions).toHaveLength(1)

    act(() => result.current.setDaySessions(key, []))
    expect(result.current.todaySessions).toEqual([])
    const stored = JSON.parse(localStorage.getItem('app')!)
    expect(stored.days[key]).toBeUndefined()
  })

  it('setDayOffType sets, clears, and rejects invalid types', () => {
    const { result } = renderHook(() => useTimeTracker())
    const key = result.current.todayKey
    act(() => result.current.setDayOffType(key, 'sick'))
    expect(result.current.daysOff[key]).toBe('sick')

    act(() => result.current.setDayOffType(key, 'not-a-type' as DayOffType))
    expect(result.current.daysOff[key]).toBe('sick') // unchanged

    act(() => result.current.setDayOffType(key, null))
    expect(result.current.daysOff[key]).toBeUndefined()
  })

  it('setDaysOffTypeBulk applies a type across multiple dates, skipping weekends', () => {
    const { result } = renderHook(() => useTimeTracker())
    act(() => result.current.setDaysOffTypeBulk(['2024-01-08', '2024-01-13'], 'personal')) // Mon, Sat
    expect(result.current.daysOff['2024-01-08']).toBe('personal')
    expect(result.current.daysOff['2024-01-13']).toBeUndefined()
  })

  it('setDaysOffTypeBulk clears markers when type is null', () => {
    const { result } = renderHook(() => useTimeTracker())
    act(() => result.current.setDaysOffTypeBulk(['2024-01-08'], 'personal'))
    act(() => result.current.setDaysOffTypeBulk(['2024-01-08'], null))
    expect(result.current.daysOff['2024-01-08']).toBeUndefined()
  })

  it('setDaysOffTypeBulk is a no-op for empty arrays or invalid types', () => {
    const { result } = renderHook(() => useTimeTracker())
    act(() => result.current.setDaysOffTypeBulk([], 'personal'))
    act(() => result.current.setDaysOffTypeBulk(['2024-01-08'], 'bogus' as DayOffType))
    expect(result.current.daysOff['2024-01-08']).toBeUndefined()
  })

  it('computes personalDaysUsedThisYear from past personal day-off entries', () => {
    const { result } = renderHook(() => useTimeTracker())
    act(() => result.current.setDayOffType('2024-01-08', 'personal'))
    act(() => result.current.setDayOffType('2024-01-09', 'personal-half'))
    expect(result.current.personalDaysUsedThisYear).toBe(1.5)
  })

  it('migrates legacy boolean day-off entries to "personal" on load', () => {
    localStorage.setItem('app', JSON.stringify({
      days: {},
      daysOff: { '2024-01-08': true },
    }))
    const { result } = renderHook(() => useTimeTracker())
    expect(result.current.daysOff['2024-01-08']).toBe('personal')
  })

  it('drops invalid legacy entries alongside a genuine boolean migration', () => {
    localStorage.setItem('app', JSON.stringify({
      days: {},
      daysOff: { '2024-01-08': 'garbage', '2024-01-09': true },
    }))
    const { result } = renderHook(() => useTimeTracker())
    expect(result.current.daysOff['2024-01-08']).toBeUndefined()
    expect(result.current.daysOff['2024-01-09']).toBe('personal')
  })

  it('auto-closes a stale open session from a past day at 21:00', () => {
    localStorage.setItem('app', JSON.stringify({
      days: {
        '2024-01-08': [{ checkIn: '2024-01-08T09:00:00.000', checkOut: null }],
      },
      daysOff: {},
    }))
    const { result } = renderHook(() => useTimeTracker())
    const day = result.current.allDays.find(d => d.date === '2024-01-08')!
    expect(day.autoCheckedOut).toBe(true)
    expect(day.sessions[0].checkOut).not.toBeNull()
  })

  it('falls back to empty data when localStorage contains invalid JSON', () => {
    localStorage.setItem('app', '{not json')
    const { result } = renderHook(() => useTimeTracker())
    expect(result.current.allDays).toEqual([])
    expect(result.current.daysOff).toEqual({})
  })

  it('marks a weekend day as isOff with zero total in allDays', () => {
    localStorage.setItem('app', JSON.stringify({
      days: {
        '2024-01-13': [{ checkIn: '2024-01-13T09:00:00.000Z', checkOut: '2024-01-13T12:00:00.000Z' }],
      },
      daysOff: {},
    }))
    const { result } = renderHook(() => useTimeTracker())
    const day = result.current.allDays.find(d => d.date === '2024-01-13')!
    expect(day.isOff).toBe(true)
    expect(day.totalMs).toBe(0)
  })

  it('computes weekTargetMs reduced by days off during the week', () => {
    const { result } = renderHook(() => useTimeTracker())
    act(() => result.current.setDayOffType('2024-01-08', 'personal'))
    expect(result.current.weekTargetMs).toBe(4 * 8 * 3600000)
  })

  it('computes weekTotalOtherDaysMs excluding today and off days', () => {
    localStorage.setItem('app', JSON.stringify({
      days: {
        '2024-01-08': [{ checkIn: '2024-01-08T09:00:00.000Z', checkOut: '2024-01-08T17:00:00.000Z' }], // 8h Monday
      },
      daysOff: {},
    }))
    const { result } = renderHook(() => useTimeTracker())
    expect(result.current.weekTotalOtherDaysMs).toBe(8 * 3600000)
  })

  it('computes allPastWorkdayOvertimeMs from prior workdays', () => {
    localStorage.setItem('app', JSON.stringify({
      days: {
        '2024-01-08': [{ checkIn: '2024-01-08T09:00:00.000Z', checkOut: '2024-01-08T19:00:00.000Z' }], // 10h, +2h OT
      },
      daysOff: {},
    }))
    const { result } = renderHook(() => useTimeTracker())
    expect(result.current.allPastWorkdayOvertimeMs).toBe(2 * 3600000)
  })

  it('exposes global stats from the stats module', () => {
    const { result } = renderHook(() => useTimeTracker())
    expect(result.current.stats.isEmpty).toBe(true)
  })
})
