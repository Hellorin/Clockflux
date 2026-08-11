import { useState, useCallback, useMemo, useRef } from 'react'
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

export function useTimeTracker() {
  const [data, setData] = useState(timeTrackingService.loadTimeTrackingData)
  const milestoneCallbackRef = useRef<((milestone: Milestone) => void) | null>(null)

  const todayKey = getTodayKey()
  const todaySessions = data.days[todayKey] || []
  const isCheckedIn = todaySessions.length > 0 && todaySessions[todaySessions.length - 1].checkOut === null

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
  const todayTargetMs = todayWorkFraction * 8 * 3600000

  const stats: GlobalStats = useMemo(() => statsService.getGlobalStats(data.days, data.daysOff), [data.days, data.daysOff])

  const personalDaysUsedThisYear = useMemo(() => ptoService.getPersonalDaysUsedThisYear(data.daysOff), [data.daysOff])

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
