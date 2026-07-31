import { useState, useCallback, useMemo, useRef } from 'react'
import { getTodayKey, sumSessionsMs, toDecimalHours, isWeekend, getWeekDays, computeWeekProgress } from '../utils/time'
import { computeGlobalStats, type GlobalStats } from '../utils/stats'
import { dayOffFraction, dayOffBaseType, isValidDayOffType } from '../utils/dayOff'
import { loadTimeEntries, saveTimeEntries } from '../services/timeEntriesRepository'
import type { DayOffType, DaysOffMap, Session, TimeEntriesData } from '../types'

export type Milestone = 'daily' | 'weekly'

export interface DayEntry {
  date: string
  sessions: Session[]
  totalMs: number
  totalDecimal: number
  isOff: boolean
  autoCheckedOut: boolean
}

function toKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const AUTO_CHECKOUT_HOUR = 21

// Auto close any open session whose check-in was on a past calendar day —
// we assume the user forgot to check out. Cap the checkout at 21:00 of the
// check-in day (or the check-in time itself if it was already later).
function autoCloseStaleSessions(data: TimeEntriesData): TimeEntriesData {
  const todayKey = getTodayKey()
  let nextDays: TimeEntriesData['days'] | null = null

  for (const dateKey of Object.keys(data.days)) {
    if (dateKey >= todayKey) continue
    const sessions = data.days[dateKey]
    const last = sessions[sessions.length - 1]
    if (!last || last.checkOut !== null) continue

    const [y, m, d] = dateKey.split('-').map(Number)
    const cutoff = new Date(y, m - 1, d, AUTO_CHECKOUT_HOUR, 0, 0, 0).getTime()
    const checkInMs = new Date(last.checkIn).getTime()
    const checkOutMs = Math.max(checkInMs, cutoff)

    if (!nextDays) nextDays = { ...data.days }
    const updated = sessions.slice()
    updated[updated.length - 1] = {
      ...last,
      checkOut: new Date(checkOutMs).toISOString(),
      autoCheckedOut: true,
    }
    nextDays[dateKey] = updated
  }

  return nextDays ? { ...data, days: nextDays } : data
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

function loadData(): TimeEntriesData {
  const parsed = loadTimeEntries() ?? { days: {}, daysOff: {} }
  if (!parsed.daysOff) parsed.daysOff = {}
  const migrated = migrateDaysOff(parsed)
  const fixed = autoCloseStaleSessions(migrated)
  if (fixed !== parsed) saveTimeEntries(fixed)
  return fixed
}

export function useTimeTracker() {
  const [data, setData] = useState(loadData)
  const milestoneCallbackRef = useRef<((milestone: Milestone) => void) | null>(null)

  const todayKey = getTodayKey()
  const todaySessions = data.days[todayKey] || []
  const isCheckedIn = todaySessions.length > 0 && todaySessions[todaySessions.length - 1].checkOut === null

  const checkIn = useCallback(() => {
    setData(prev => {
      const key = getTodayKey()
      // Prevent check-in on full days off (including weekends). Half days
      // off still allow check-in for the working half of the day.
      if (dayOffFraction(prev.daysOff[key]) === 1 || isWeekend(key)) return prev
      const next = { ...prev, days: { ...prev.days } }
      const todaySessions = [...(next.days[key] || [])]
      // Prevent double check-in
      if (todaySessions.length > 0 && todaySessions[todaySessions.length - 1].checkOut === null) {
        return prev
      }
      todaySessions.push({ checkIn: new Date().toISOString(), checkOut: null })
      next.days[key] = todaySessions
      saveTimeEntries(next)
      return next
    })
  }, [])

  const checkOut = useCallback(() => {
    setData(prev => {
      const key = getTodayKey()
      const sessions = [...(prev.days[key] || [])]
      const lastIdx = sessions.length - 1
      if (lastIdx < 0 || sessions[lastIdx].checkOut !== null) return prev

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
      saveTimeEntries(next)

      // AFTER: all sessions closed including the one just closed
      const dailyAfter = toDecimalHours(sumSessionsMs(sessions))
      const { weekTotal: weekAfter } = computeWeekProgress(weekDays, next.days, next.daysOff)

      // Detect milestone crossing
      const crossedDaily = dailyBefore < 8 && dailyAfter >= 8
      const crossedWeekly = weekTarget > 0 && weekBefore < weekTarget && weekAfter >= weekTarget
      let milestone: Milestone | null = null
      if (crossedWeekly) milestone = 'weekly'
      else if (crossedDaily) milestone = 'daily'
      if (milestone) milestoneCallbackRef.current?.(milestone)

      return next
    })
  }, [])

  // Build sorted history (newest first), excluding today if today has no sessions
  const allDays: DayEntry[] = Object.entries(data.days)
    .filter(([, sessions]) => sessions.length > 0)
    .map(([date, sessions]) => {
      const isOff = dayOffFraction(data.daysOff[date]) === 1 || isWeekend(date)
      const totalMs = isOff ? 0 : sumSessionsMs(sessions)
      const autoCheckedOut = sessions.some(s => s.autoCheckedOut)
      return { date, sessions, totalMs, totalDecimal: toDecimalHours(totalMs), isOff, autoCheckedOut }
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  const setDaySessions = useCallback((dateKey: string, sessions: Session[]) => {
    setData(prev => {
      const next = { ...prev, days: { ...prev.days } }
      if (sessions.length === 0) {
        delete next.days[dateKey]
      } else {
        next.days[dateKey] = sessions
      }
      saveTimeEntries(next)
      return next
    })
  }, [])

  // type: one of DAY_OFF_TYPES (see utils/dayOff.ts), or null to clear the marker
  const setDayOffType = useCallback((dateKey: string, type: DayOffType | null) => {
    setData(prev => {
      const daysOff = { ...prev.daysOff }
      if (type === null) {
        delete daysOff[dateKey]
      } else if (isValidDayOffType(type)) {
        daysOff[dateKey] = type
      } else {
        return prev
      }
      const next = { ...prev, daysOff }
      saveTimeEntries(next)
      return next
    })
  }, [])

  // Bulk variant: applies the same day-off type (or clears) to many dates at once.
  // Weekends are skipped — they're implicitly off and can't carry a personal/official marker.
  const setDaysOffTypeBulk = useCallback((dateKeys: string[], type: DayOffType | null) => {
    if (!Array.isArray(dateKeys) || dateKeys.length === 0) return
    if (type !== null && !isValidDayOffType(type)) return
    setData(prev => {
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
      saveTimeEntries(next)
      return next
    })
  }, [])

  // Fraction of today expected to be worked: 0 on a full day off or weekend,
  // 0.5 on a half day off, 1 otherwise.
  const todayWorkFraction = isWeekend(todayKey) ? 0 : 1 - dayOffFraction(data.daysOff[todayKey])
  const isTodayOff = todayWorkFraction === 0
  const todayTargetMs = todayWorkFraction * 8 * 3600000

  const stats: GlobalStats = useMemo(() => computeGlobalStats(data.days, data.daysOff), [data.days, data.daysOff])

  const personalDaysUsedThisYear = useMemo(() => {
    const prefix = `${new Date().getFullYear()}-`
    const todayKey = getTodayKey()
    let n = 0
    for (const [k, v] of Object.entries(data.daysOff)) {
      if (dayOffBaseType(v) === 'personal' && k.startsWith(prefix) && k <= todayKey) n += dayOffFraction(v)
    }
    return n
  }, [data.daysOff])

  const setMilestoneCallback = useCallback((fn: ((milestone: Milestone) => void) | null) => { milestoneCallbackRef.current = fn }, [])

  // Week progress — all in raw ms for minute-level precision (live today added in TodaySummary)
  const weekDays = getWeekDays()
  const weekdays = weekDays.slice(0, 5)
  const daysOffSum = weekdays.reduce((sum, d) => sum + dayOffFraction(data.daysOff[toKey(d)]), 0)
  const weekTargetMs = (5 - daysOffSum) * 8 * 3600000
  const weekTotalOtherDaysMs = weekDays.reduce((sum, date) => {
    const key = toKey(date)
    if (key === todayKey || dayOffFraction(data.daysOff[key]) === 1 || isWeekend(key)) return sum
    const sessions = data.days[key] || []
    return sum + sumSessionsMs(sessions)
  }, 0)
  // How many hours were expected based on elapsed workdays (Mon through today, excl. days off)
  const elapsedWorkFraction = weekdays.reduce((sum, d) => {
    const key = toKey(d)
    if (isWeekend(key) || key >= todayKey) return sum
    return sum + (1 - dayOffFraction(data.daysOff[key]))
  }, 0)
  const weekElapsedTargetMs = elapsedWorkFraction * 8 * 3600000

  // Cumulative overtime from all workdays before today (all history, not just this week)
  const allPastWorkdayOvertimeMs = Object.entries(data.days).reduce((sum, [key, sessions]) => {
    if (key >= todayKey || isWeekend(key)) return sum
    const fraction = dayOffFraction(data.daysOff[key])
    if (fraction === 1) return sum
    return sum + sumSessionsMs(sessions) - (1 - fraction) * 8 * 3600000
  }, 0)

  return {
    isCheckedIn,
    checkIn,
    checkOut,
    todaySessions,
    todayKey,
    allDays,
    setDaySessions,
    daysOff: data.daysOff,
    setDayOffType,
    setDaysOffTypeBulk,
    isTodayOff,
    todayTargetMs,
    personalDaysUsedThisYear,
    setMilestoneCallback,
    weekTargetMs,
    weekTotalOtherDaysMs,
    weekElapsedTargetMs,
    allPastWorkdayOvertimeMs,
    stats,
  }
}
