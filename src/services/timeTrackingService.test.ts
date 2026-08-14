import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkIn, checkOut, findOpenSession } from './timeTrackingService'
import { closeStaleSessions } from './autoCheckoutService'
import type { TimeEntriesData } from '../types'

/**
 * Regression cover for the midnight rollover, which had no test at all and was
 * the most damaging defect found in the 2026-08-14 production-readiness audit.
 *
 * Every one of these paths used to key off getTodayKey() alone. That is correct
 * exactly until a session outlives the calendar day it started in, at which
 * point the app looked under a date that held no sessions and concluded nothing
 * was running. Tapping "check out" then returned the same object, React's
 * Object.is bail-out meant literally nothing happened, and on the next reload
 * closeStaleSessions closed the abandoned session at max(checkIn, 21:00) — for
 * a 22:00 start, that is the check-in time itself, so a whole night shift was
 * recorded as zero hours.
 *
 * Dates are built with local-time constructors throughout, because getTodayKey
 * is local-time and a UTC literal would make these pass or fail depending on
 * the machine's timezone.
 */

// Wednesday 2024-01-10, 22:00 local — a shift that will run past midnight.
const NIGHT_START = new Date(2024, 0, 10, 22, 0, 0)
// Thursday 2024-01-11, 00:30 local — same shift, next calendar day.
const AFTER_MIDNIGHT = new Date(2024, 0, 11, 0, 30, 0)

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const empty: TimeEntriesData = { days: {}, daysOff: {} }

describe('findOpenSession', () => {
  it('finds a session opened on an earlier day', () => {
    const data: TimeEntriesData = {
      days: { '2024-01-10': [{ checkIn: NIGHT_START.toISOString(), checkOut: null }] },
      daysOff: {},
    }
    expect(findOpenSession(data.days)).toEqual({ dateKey: '2024-01-10', index: 0 })
  })

  it('returns null when every session is closed', () => {
    const data: TimeEntriesData = {
      days: {
        '2024-01-10': [
          { checkIn: NIGHT_START.toISOString(), checkOut: AFTER_MIDNIGHT.toISOString() },
        ],
      },
      daysOff: {},
    }
    expect(findOpenSession(data.days)).toBeNull()
  })

  it('prefers the most recent day when older days also look open', () => {
    // Shouldn't arise now that checkIn refuses a second concurrent session, but
    // historical data can contain it, and closing the newest is the safe pick.
    const data: TimeEntriesData = {
      days: {
        '2024-01-08': [{ checkIn: new Date(2024, 0, 8, 9, 0).toISOString(), checkOut: null }],
        '2024-01-10': [{ checkIn: NIGHT_START.toISOString(), checkOut: null }],
      },
      daysOff: {},
    }
    expect(findOpenSession(data.days)?.dateKey).toBe('2024-01-10')
  })
})

describe('checkOut across midnight', () => {
  it('closes the session under the day it started, with the real duration', () => {
    vi.setSystemTime(NIGHT_START)
    const started = checkIn(empty)
    expect(started.days['2024-01-10']).toHaveLength(1)

    // The clock rolls over while the session is still running.
    vi.setSystemTime(AFTER_MIDNIGHT)
    const { data } = checkOut(started)

    // Recorded against the day the shift began, not the day it ended.
    expect(Object.keys(data.days)).toEqual(['2024-01-10'])
    const session = data.days['2024-01-10'][0]
    expect(session.checkOut).not.toBeNull()

    // The whole point: 2.5 hours, not zero.
    const durationMs = new Date(session.checkOut!).getTime() - new Date(session.checkIn).getTime()
    expect(durationMs).toBe(2.5 * 60 * 60 * 1000)
  })

  it('actually changes the data, rather than silently returning the same object', () => {
    vi.setSystemTime(NIGHT_START)
    const started = checkIn(empty)

    vi.setSystemTime(AFTER_MIDNIGHT)
    const { data } = checkOut(started)

    // This is what made the bug invisible: returning `prev` unchanged meant
    // React bailed out of the re-render and the button appeared inert.
    expect(data).not.toBe(started)
  })

  it('is still a no-op when nothing is running', () => {
    vi.setSystemTime(AFTER_MIDNIGHT)
    const { data, milestone } = checkOut(empty)
    expect(data).toBe(empty)
    expect(milestone).toBeNull()
  })
})

describe('checkIn while a session from a previous day is open', () => {
  it('refuses rather than opening a second concurrent session', () => {
    vi.setSystemTime(NIGHT_START)
    const started = checkIn(empty)

    vi.setSystemTime(AFTER_MIDNIGHT)
    const again = checkIn(started)

    expect(again).toBe(started)
    expect(again.days['2024-01-11']).toBeUndefined()
  })
})

describe('daily milestone respects a custom target', () => {
  // The 8h threshold was hardcoded, so a Pro user on the "custom-daily-target"
  // feature got no celebration when they actually hit their goal, and an
  // unexpected one two hours later.
  function dayWithOpenSessionSince(hour: number): TimeEntriesData {
    return {
      days: { '2024-01-10': [{ checkIn: new Date(2024, 0, 10, hour, 0).toISOString(), checkOut: null }] },
      daysOff: {},
    }
  }

  it('fires at 6h for a 6h target', () => {
    vi.setSystemTime(new Date(2024, 0, 10, 15, 0)) // 6h after a 09:00 start
    const { milestone } = checkOut(dayWithOpenSessionSince(9), 6)
    expect(milestone).toBe('daily')
  })

  it('does not fire at 6h for the default 8h target', () => {
    vi.setSystemTime(new Date(2024, 0, 10, 15, 0))
    const { milestone } = checkOut(dayWithOpenSessionSince(9), 8)
    expect(milestone).toBeNull()
  })
})

describe('closeStaleSessions', () => {
  it('never records a zero-length session for a check-in after the cutoff hour', () => {
    // 22:00 is past the 21:00 auto-checkout cutoff, so max(checkIn, cutoff)
    // used to resolve to the check-in time and wipe out the entire shift.
    const data: TimeEntriesData = {
      days: { '2024-01-10': [{ checkIn: NIGHT_START.toISOString(), checkOut: null }] },
      daysOff: {},
    }
    const fixed = closeStaleSessions(data, '2024-01-12')
    const session = fixed.days['2024-01-10'][0]

    expect(session.autoCheckedOut).toBe(true)
    const durationMs = new Date(session.checkOut!).getTime() - new Date(session.checkIn).getTime()
    expect(durationMs).toBeGreaterThan(0)
  })

  it('still caps a normal daytime session at the cutoff hour', () => {
    const data: TimeEntriesData = {
      days: { '2024-01-10': [{ checkIn: new Date(2024, 0, 10, 9, 0).toISOString(), checkOut: null }] },
      daysOff: {},
    }
    const fixed = closeStaleSessions(data, '2024-01-12')
    expect(new Date(fixed.days['2024-01-10'][0].checkOut!).getHours()).toBe(21)
  })

  it('leaves today alone', () => {
    const data: TimeEntriesData = {
      days: { '2024-01-10': [{ checkIn: NIGHT_START.toISOString(), checkOut: null }] },
      daysOff: {},
    }
    expect(closeStaleSessions(data, '2024-01-10')).toBe(data)
  })
})
