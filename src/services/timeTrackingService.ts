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

// Prevent check-in on full days off (including weekends). Half days off
// still allow check-in for the working half of the day. No-op (returns the
// same reference) when the check-in is rejected or redundant.
export function checkIn(prev: TimeEntriesData): TimeEntriesData {
  const key = getTodayKey()
  if (dayOffFraction(prev.daysOff[key]) === 1 || isWeekend(key)) return prev
  const todaySessions = [...(prev.days[key] || [])]
  if (todaySessions.length > 0 && todaySessions[todaySessions.length - 1].checkOut === null) {
    return prev
  }
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
export function checkOut(prev: TimeEntriesData): CheckOutResult {
  const key = getTodayKey()
  const sessions = [...(prev.days[key] || [])]
  const lastIdx = sessions.length - 1
  if (lastIdx < 0 || sessions[lastIdx].checkOut !== null) return { data: prev, milestone: null }

  const now = Date.now()

  // BEFORE: only previously closed sessions (excludes the current open session)
  const closedSessions = sessions.slice(0, lastIdx)
  const dailyBefore = toDecimalHours(sumSessionsMs(closedSessions))
  const weekDays = getWeekDays()
  const beforeDays = { ...prev.days, [key]: closedSessions }
  const { weekTotal: weekBefore, weekTarget } = computeWeekProgress(weekDays, beforeDays, prev.daysOff)

  // Apply mutation
  sessions[lastIdx] = { ...sessions[lastIdx], checkOut: new Date(now).toISOString() }
  const next = { ...prev, days: { ...prev.days, [key]: sessions } }
  resolveRepository().save(next)

  // AFTER: all sessions closed including the one just closed
  const dailyAfter = toDecimalHours(sumSessionsMs(sessions))
  const { weekTotal: weekAfter } = computeWeekProgress(weekDays, next.days, next.daysOff)

  const crossedDaily = dailyBefore < 8 && dailyAfter >= 8
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
