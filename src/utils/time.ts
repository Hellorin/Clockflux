import { dayOffFraction } from './dayOff'
import type { DaysMap, DaysOffMap, Session } from '../types'

/**
 * Returns today's date key in "YYYY-MM-DD" format using local time.
 */
export function getTodayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Converts milliseconds to decimal hours rounded to the nearest quarter-hour.
 * e.g. 8h15m → 8.25, 8h30m → 8.5, 8h45m → 8.75
 */
export function toDecimalHours(ms: number): number {
  const totalMinutes = ms / 1000 / 60
  const quarters = Math.round(totalMinutes / 15)
  return quarters / 4
}

/**
 * Sums all sessions for a day in milliseconds.
 * Open sessions (checkOut === null) are counted up to now.
 */
export function sumSessionsMs(sessions: Session[], now: number = Date.now()): number {
  return sessions.reduce((total, session) => {
    const start = new Date(session.checkIn).getTime()
    const end = session.checkOut ? new Date(session.checkOut).getTime() : now
    return total + Math.max(0, end - start)
  }, 0)
}

/**
 * Converts milliseconds to "HH:MM" string (floor, no rounding).
 * e.g. 8h15m → "8:15"
 */
export function toHoursMinutes(ms: number): string {
  const totalMinutes = Math.floor(ms / 1000 / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/**
 * Converts decimal hours (e.g. 8.25) to "H:MM" (e.g. "8:15").
 */
export function decimalToHoursMinutes(decimalHours: number): string {
  return toHoursMinutes(decimalHours * 3600000)
}

/**
 * Formats milliseconds as HH:MM:SS for the live timer.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

/**
 * Formats a date key "YYYY-MM-DD" into a human-readable string.
 * e.g. "2026-03-03" → "Tue, Mar 3, 2026"
 */
export function formatDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Returns true if the given "YYYY-MM-DD" date key falls on a Saturday or Sunday.
 */
export function isWeekend(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay() // 0=Sun, 6=Sat
  return dow === 0 || dow === 6
}

/**
 * Returns the 7 Date objects (Mon–Sun) for the week containing referenceDate.
 */
export function getWeekDays(referenceDate: Date = new Date()): Date[] {
  const dow = referenceDate.getDay() // 0=Sun, 6=Sat
  const stepsBack = dow === 0 ? 6 : dow - 1 // steps back to Monday
  const monday = new Date(referenceDate)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - stepsBack)
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d)
  }
  return days
}

function toKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface WeekProgress {
  weekTotal: number
  weekTarget: number
  effectiveTarget: number
  isCurrentWeek: boolean
}

/**
 * Given the 7 Date objects for a week, the raw days map from localStorage,
 * and the daysOff map, returns weekly progress metrics.
 * Mirrors the logic in CalendarView week summary.
 */
export function computeWeekProgress(weekDays: Date[], days: DaysMap, daysOff: DaysOffMap): WeekProgress {
  const today = getTodayKey()

  const weekTotal = weekDays.reduce((sum, date) => {
    const key = toKey(date)
    if (dayOffFraction(daysOff[key]) === 1) return sum
    const sessions = days[key] || []
    return sum + toDecimalHours(sumSessionsMs(sessions))
  }, 0)

  const weekdays = weekDays.slice(0, 5) // Mon–Fri
  const daysOffSum = weekdays.reduce((sum, d) => sum + dayOffFraction(daysOff[toKey(d)]), 0)
  const weekTarget = (5 - daysOffSum) * 8

  const isCurrentWeek = weekDays.some(d => toKey(d) === today)
  let effectiveTarget = weekTarget
  if (isCurrentWeek) {
    const daysElapsed = weekdays.reduce((sum, d) => {
      const key = toKey(d)
      if (isWeekend(key) || key > today) return sum
      return sum + (1 - dayOffFraction(daysOff[key]))
    }, 0)
    effectiveTarget = daysElapsed * 8
  }

  return { weekTotal, weekTarget, effectiveTarget, isCurrentWeek }
}

/**
 * Formats an ISO timestamp as a local time string, e.g. "09:03".
 */
export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
}
