import { getTodayKey, sumSessionsMs, toDecimalHours, isWeekend, getWeekDays, computeWeekProgress } from '../utils/time'
import { dayOffFraction, isValidDayOffType } from '../utils/dayOff'
import { localStorageTimeEntriesRepository } from '../repositories/localStorageTimeEntriesRepository'
import { closeStaleSessions } from './autoCheckoutService'
import type { TimeEntriesRepository } from '../repositories/types'
import type { DayOffType, DaysOffMap, Session, TimeEntriesData } from '../types'

export type Milestone = 'daily' | 'weekly'

// Single seam for choosing which store backs time entries. Everyone is on
// local storage today; once persistence is a paid feature, this is where
// we'd branch to a backend-backed repository per user/plan instead of
// changing every call site below.
function resolveRepository(): TimeEntriesRepository {
  return localStorageTimeEntriesRepository
}

// Convert legacy `daysOff[key] = true` entries to the typed form
// `daysOff[key] = "personal"`. Existing days off are conservatively assumed
// to have consumed the user's holiday allowance.
function migrateDaysOff(data: TimeEntriesData): TimeEntriesData {
  let changed = false
  const next: DaysOffMap = {}
  for (const [k, v] of Object.entries(data.daysOff)) {
    if ((v as unknown) === true) {
      next[k] = 'personal'
      changed = true
    } else if (isValidDayOffType(v)) {
      next[k] = v
    }
  }
  return changed ? { ...data, daysOff: next } : data
}

export function loadTimeTrackingData(): TimeEntriesData {
  const repository = resolveRepository()
  const parsed = repository.load() ?? { days: {}, daysOff: {} }
  if (!parsed.daysOff) parsed.daysOff = {}
  const migrated = migrateDaysOff(parsed)
  const fixed = closeStaleSessions(migrated, getTodayKey())
  if (fixed !== parsed) repository.save(fixed)
  return fixed
}

// Overwrites local time-entry data wholesale (e.g. restoring a synced
// snapshot pulled from the backend). Runs it through the same migration/
// stale-session fixups as a normal load so a restored snapshot can't put
// the app in a state a fresh load never would.
export function replaceAll(incoming: TimeEntriesData): TimeEntriesData {
  const migrated = migrateDaysOff({ days: incoming.days ?? {}, daysOff: incoming.daysOff ?? {} })
  const fixed = closeStaleSessions(migrated, getTodayKey())
  resolveRepository().save(fixed)
  return fixed
}

/** Where the one currently-running session lives. */
export interface OpenSession {
  /** The date key the session was *started* under, which is not necessarily today. */
  dateKey: string
  index: number
}

/**
 * Finds the running (not yet checked out) session, wherever it lives.
 *
 * Every caller here used to look under `getTodayKey()` alone, which silently
 * broke the moment a session outlived the calendar day it started in. A shift
 * beginning at 22:00 is still running at 00:30, but by then today's key is the
 * *next* day and holds no sessions at all — so the app believed nothing was
 * running, checkOut() became a no-op, and the shift was eventually recorded as
 * zero hours by closeStaleSessions. Searching newest-key-first finds it
 * regardless of which day it was opened on.
 */
export function findOpenSession(days: TimeEntriesData['days']): OpenSession | null {
  const keys = Object.keys(days).sort()
  for (let i = keys.length - 1; i >= 0; i--) {
    const dateKey = keys[i]
    const sessions = days[dateKey]
    if (!sessions || sessions.length === 0) continue
    const index = sessions.length - 1
    if (sessions[index].checkOut === null) return { dateKey, index }
  }
  return null
}

// Prevent check-in on full days off (including weekends). Half days off
// still allow check-in for the working half of the day. No-op (returns the
// same reference) when the check-in is rejected or redundant.
export function checkIn(prev: TimeEntriesData): TimeEntriesData {
  const key = getTodayKey()
  if (dayOffFraction(prev.daysOff[key]) === 1 || isWeekend(key)) return prev
  // Checked across every day rather than just today's: a session opened before
  // midnight is still running after it, and looking only under today's key
  // would let the user open a second concurrent session on top of it.
  if (findOpenSession(prev.days)) return prev
  const todaySessions = [...(prev.days[key] || [])]
  todaySessions.push({ checkIn: new Date().toISOString(), checkOut: null })
  const next = { ...prev, days: { ...prev.days, [key]: todaySessions } }
  resolveRepository().save(next)
  return next
}

export interface CheckOutResult {
  data: TimeEntriesData
  milestone: Milestone | null
}

// No-op (milestone: null, same data reference) when there's no open session.
//
// The session is closed under the day it was *started* on, not today's — an
// overnight shift belongs to the day the user began working, and the checkOut
// timestamp is free to land on the following date. Previously this looked only
// under getTodayKey(), so after midnight it found nothing, returned `prev`
// unchanged, and React's Object.is bail-out meant tapping "check out" did
// nothing whatsoever: no error, no state change, no visible feedback.
export function checkOut(
  prev: TimeEntriesData,
  // The daily milestone used to be hardcoded at 8h, so a Pro user on the
  // "custom-daily-target" feature with a 6h day got no celebration at 6h and an
  // unexpected one at 8h — while the Track tab's progress bar, which does read
  // their setting, had shown them complete two hours earlier.
  dailyTargetHours: number = 8,
): CheckOutResult {
  const open = findOpenSession(prev.days)
  if (!open) return { data: prev, milestone: null }

  const key = open.dateKey
  const lastIdx = open.index
  const sessions = [...prev.days[key]]

  const now = Date.now()

  // BEFORE: only previously closed sessions (excludes the current open session)
  const closedSessions = sessions.slice(0, lastIdx)
  const dailyBefore = toDecimalHours(sumSessionsMs(closedSessions))
  const weekDays = getWeekDays()
  const beforeDays = { ...prev.days, [key]: closedSessions }
  const { weekTotal: weekBefore, weekTarget } = computeWeekProgress(weekDays, beforeDays, prev.daysOff, dailyTargetHours)

  // Apply mutation
  sessions[lastIdx] = { ...sessions[lastIdx], checkOut: new Date(now).toISOString() }
  const next = { ...prev, days: { ...prev.days, [key]: sessions } }
  resolveRepository().save(next)

  // AFTER: all sessions closed including the one just closed
  const dailyAfter = toDecimalHours(sumSessionsMs(sessions))
  const { weekTotal: weekAfter } = computeWeekProgress(weekDays, next.days, next.daysOff, dailyTargetHours)

  const crossedDaily = dailyBefore < dailyTargetHours && dailyAfter >= dailyTargetHours
  const crossedWeekly = weekTarget > 0 && weekBefore < weekTarget && weekAfter >= weekTarget
  let milestone: Milestone | null = null
  if (crossedWeekly) milestone = 'weekly'
  else if (crossedDaily) milestone = 'daily'

  return { data: next, milestone }
}

export function setDaySessions(prev: TimeEntriesData, dateKey: string, sessions: Session[]): TimeEntriesData {
  const next = { ...prev, days: { ...prev.days } }
  if (sessions.length === 0) {
    delete next.days[dateKey]
  } else {
    next.days[dateKey] = sessions
  }
  resolveRepository().save(next)
  return next
}

// type: one of DAY_OFF_TYPES (see utils/dayOff.ts), or null to clear the marker.
// No-op (returns the same reference) for an invalid type.
export function setDayOffType(prev: TimeEntriesData, dateKey: string, type: DayOffType | null): TimeEntriesData {
  const daysOff = { ...prev.daysOff }
  if (type === null) {
    delete daysOff[dateKey]
  } else if (isValidDayOffType(type)) {
    daysOff[dateKey] = type
  } else {
    return prev
  }
  const next = { ...prev, daysOff }
  resolveRepository().save(next)
  return next
}

// Bulk variant: applies the same day-off type (or clears) to many dates at once.
// Weekends are skipped — they're implicitly off and can't carry a personal/official marker.
export function setDaysOffTypeBulk(prev: TimeEntriesData, dateKeys: string[], type: DayOffType | null): TimeEntriesData {
  if (!Array.isArray(dateKeys) || dateKeys.length === 0) return prev
  if (type !== null && !isValidDayOffType(type)) return prev
  const daysOff = { ...prev.daysOff }
  for (const dateKey of dateKeys) {
    if (isWeekend(dateKey)) continue
    if (type === null) {
      delete daysOff[dateKey]
    } else {
      daysOff[dateKey] = type
    }
  }
  const next = { ...prev, daysOff }
  resolveRepository().save(next)
  return next
}
