import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { getTodayKey, sumSessionsMs, toDecimalHours, isWeekend, getWeekDays } from '../utils/time'
import { dayOffFraction } from '../utils/dayOff'
import * as timeTrackingService from '../services/timeTrackingService'
import * as ptoService from '../services/ptoService'
import * as statsService from '../services/statsService'
import type { GlobalStats } from '../utils/stats'
import type { DayOffType, Session, TimeEntriesData } from '../types'

export type Milestone = timeTrackingService.Milestone

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

// Restricts a days/daysOff map to entries dated within `year` (the "YYYY"
// prefix of the date key). Used to cap free-plan users to the current year
// everywhere history is displayed or summed, while the underlying storage
// (and anything synced to the backend) keeps every year untouched.
function filterToYear<T>(map: Record<string, T>, year: string): Record<string, T> {
  const out: Record<string, T> = {}
  for (const [key, value] of Object.entries(map)) {
    if (key.startsWith(year)) out[key] = value
  }
  return out
}

// `unlimitedHistory`: Pro-only entitlement. When false (the free-plan
// default), every history-derived view (allDays, stats, cumulative
// overtime) is capped to the current year — full data still lives in
// storage and still syncs in full, this only trims what's read back out.
export function useTimeTracker(dailyTargetHours: number = 8, unlimitedHistory: boolean = true) {
  const [data, setData] = useState(timeTrackingService.loadTimeTrackingData)
  const milestoneCallbackRef = useRef<((milestone: Milestone) => void) | null>(null)

  // `dayEpoch` exists only to force a re-render when the local date rolls over.
  // Everything below derives from getTodayKey(), which was previously computed
  // during render and then never recomputed, because nothing re-renders this
  // hook at midnight — LiveTimer, TodaySummary and HistoryList each keep their
  // own tick in local state. So a session left running across midnight kept
  // being measured against the previous day right up until the next reload.
  const [dayEpoch, setDayEpoch] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dayEpoch is deliberately an invalidation key rather than a value read inside: getTodayKey() reads the clock, which the dependency array cannot express, so bumping dayEpoch at midnight is what recomputes it
  const todayKey = useMemo(() => getTodayKey(), [dayEpoch])

  useEffect(() => {
    const now = new Date()
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0)
    // +1s of slack so the timer cannot fire a hair early and read the old date.
    const id = setTimeout(() => setDayEpoch(e => e + 1), nextMidnight.getTime() - now.getTime())
    return () => clearTimeout(id)
  }, [dayEpoch])

  const todaySessions = data.days[todayKey] || []
  // Derived from the open session wherever it lives, not from today's key: a
  // shift started at 22:00 is still running at 00:30, and keying this off
  // today's (now empty) entry made the app show "checked out" while the timer
  // was in fact still going.
  const isCheckedIn = timeTrackingService.findOpenSession(data.days) !== null

  const currentYear = todayKey.slice(0, 4)
  const historyDays = unlimitedHistory ? data.days : filterToYear(data.days, currentYear)
  const historyDaysOff = unlimitedHistory ? data.daysOff : filterToYear(data.daysOff, currentYear)

  const checkIn = useCallback(() => {
    setData(prev => timeTrackingService.checkIn(prev))
  }, [])

  const checkOut = useCallback(() => {
    setData(prev => {
      const { data: next, milestone } = timeTrackingService.checkOut(prev)
      if (milestone) milestoneCallbackRef.current?.(milestone)
      return next
    })
  }, [])

  // Build sorted history (newest first), excluding today if today has no sessions
  const allDays: DayEntry[] = Object.entries(historyDays)
    .filter(([, sessions]) => sessions.length > 0)
    .map(([date, sessions]) => {
      const isOff = dayOffFraction(historyDaysOff[date]) === 1 || isWeekend(date)
      const totalMs = isOff ? 0 : sumSessionsMs(sessions)
      const autoCheckedOut = sessions.some(s => s.autoCheckedOut)
      return { date, sessions, totalMs, totalDecimal: toDecimalHours(totalMs), isOff, autoCheckedOut }
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  const setDaySessions = useCallback((dateKey: string, sessions: Session[]) => {
    setData(prev => timeTrackingService.setDaySessions(prev, dateKey, sessions))
  }, [])

  const setDayOffType = useCallback((dateKey: string, type: DayOffType | null) => {
    setData(prev => timeTrackingService.setDayOffType(prev, dateKey, type))
  }, [])

  const setDaysOffTypeBulk = useCallback((dateKeys: string[], type: DayOffType | null) => {
    setData(prev => timeTrackingService.setDaysOffTypeBulk(prev, dateKeys, type))
  }, [])

  // Wholesale overwrite, used to restore a synced snapshot pulled from the
  // backend. Not exposed anywhere in the UI, only to the sync hook.
  const replaceAll = useCallback((next: TimeEntriesData) => {
    setData(timeTrackingService.replaceAll(next))
  }, [])

  // Fraction of today expected to be worked: 0 on a full day off or weekend,
  // 0.5 on a half day off, 1 otherwise.
  const todayWorkFraction = isWeekend(todayKey) ? 0 : 1 - dayOffFraction(data.daysOff[todayKey])
  const isTodayOff = todayWorkFraction === 0
  const todayTargetMs = todayWorkFraction * dailyTargetHours * 3600000

  const stats: GlobalStats = useMemo(() => statsService.getGlobalStats(historyDays, historyDaysOff), [historyDays, historyDaysOff])

  const personalDaysUsedThisYear = useMemo(() => ptoService.getPersonalDaysUsedThisYear(data.daysOff), [data.daysOff])

  const setMilestoneCallback = useCallback((fn: ((milestone: Milestone) => void) | null) => { milestoneCallbackRef.current = fn }, [])

  // Week progress — all in raw ms for minute-level precision (live today added in TodaySummary)
  const weekDays = getWeekDays()
  const weekdays = weekDays.slice(0, 5)
  const daysOffSum = weekdays.reduce((sum, d) => sum + dayOffFraction(data.daysOff[toKey(d)]), 0)
  const weekTargetMs = (5 - daysOffSum) * dailyTargetHours * 3600000
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
  const weekElapsedTargetMs = elapsedWorkFraction * dailyTargetHours * 3600000

  // Cumulative overtime from all workdays before today (all history, not just
  // this week — capped to the current year on the free plan, same as allDays/stats)
  const allPastWorkdayOvertimeMs = Object.entries(historyDays).reduce((sum, [key, sessions]) => {
    if (key >= todayKey || isWeekend(key)) return sum
    const fraction = dayOffFraction(historyDaysOff[key])
    if (fraction === 1) return sum
    return sum + sumSessionsMs(sessions) - (1 - fraction) * dailyTargetHours * 3600000
  }, 0)

  return {
    isCheckedIn,
    checkIn,
    checkOut,
    todaySessions,
    todayKey,
    allDays,
    setDaySessions,
    days: data.days,
    daysOff: data.daysOff,
    setDayOffType,
    setDaysOffTypeBulk,
    replaceAll,
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
