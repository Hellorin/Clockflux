import { useState, useMemo, useEffect } from 'react'
import { formatDateKey, formatTime, toHoursMinutes, toDecimalHours, getWeekDays, sumSessionsMs } from '../utils/time'
import { dayOffFraction } from '../utils/dayOff'
import type { DayEntry } from '../hooks/useTimeTracker'
import type { DaysOffMap, HoursFormat } from '../types'

interface HistoryListProps {
  allDays: DayEntry[]
  todayKey: string
  hoursFormat: HoursFormat
  daysOff?: DaysOffMap
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getWeekKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const weekDays = getWeekDays(new Date(y, m - 1, d))
  return toDateKey(weekDays[0])
}

function getWeekLabel(weekKey: string): string {
  const [y, m, d] = weekKey.split('-').map(Number)
  const monday = new Date(y, m - 1, d)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${fmt(monday)} – ${fmt(sunday)}`
}

interface HistoryDayProps {
  day: DayEntry
  todayKey: string
  hoursFormat: HoursFormat
}

function HistoryDay({ day, todayKey, hoursFormat }: HistoryDayProps) {
  const isToday = day.date === todayKey
  const [expanded, setExpanded] = useState(isToday)
  const hasActiveSession = day.sessions.some(s => s.checkOut === null)

  return (
    <li className="history-day">
      <button
        type="button"
        className="history-day-header"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span className="history-date">
          {isToday ? 'Today' : formatDateKey(day.date)}
          {hasActiveSession && <span className="session-live-dot" aria-label="session in progress" />}
          {day.autoCheckedOut && (
            <span
              className="auto-checkout-badge"
              title="You likely forgot to check out — auto-closed at 21:00"
              aria-label="Auto-checked-out at 21:00; verify the hours are correct"
            >
              ⚠ auto
            </span>
          )}
        </span>
        <span className="history-total">{hoursFormat === 'hhmm' ? toHoursMinutes(day.totalMs) : day.totalDecimal}h</span>
        <span className="history-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <ul className="history-sessions">
          {day.sessions.map(session => (
            <li key={session.checkIn} className={`history-session${session.checkOut === null ? ' history-session--active' : ''}${session.autoCheckedOut ? ' history-session--auto' : ''}`}>
              <span>{formatTime(session.checkIn)}</span>
              <span className="session-arrow">→</span>
              <span>
                {session.checkOut ? formatTime(session.checkOut) : '...'}
                {session.autoCheckedOut && <span className="session-auto-flag" title="Auto-checked-out at 21:00"> ⚠</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

interface HistoryWeekProps {
  weekKey: string
  days: DayEntry[]
  todayKey: string
  hoursFormat: HoursFormat
  defaultExpanded: boolean
  daysOff: DaysOffMap
  isCurrentWeek: boolean
  cumulativeOvertimeBeforeMs: number
}

function HistoryWeek({ weekKey, days, todayKey, hoursFormat, defaultExpanded, daysOff, isCurrentWeek, cumulativeOvertimeBeforeMs }: HistoryWeekProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const totalMs = days.reduce((sum, d) => sum + d.totalMs, 0)
  const label = getWeekLabel(weekKey)

  const [y, m, d] = weekKey.split('-').map(Number)
  const weekdays = getWeekDays(new Date(y, m - 1, d)).slice(0, 5)
  const daysOffSum = weekdays.reduce((sum, date) => sum + dayOffFraction(daysOff[toDateKey(date)]), 0)
  const weekTargetMs = (5 - daysOffSum) * 8 * 3600000

  type WeekStatus = 'pending' | 'success' | 'partial' | 'fail'
  let status: WeekStatus = 'pending'
  if (weekTargetMs > 0) {
    if (totalMs >= weekTargetMs) status = 'success'
    else if (!isCurrentWeek) {
      const deficitMs = weekTargetMs - totalMs
      status = cumulativeOvertimeBeforeMs >= deficitMs ? 'partial' : 'fail'
    }
  }

  const STATUS_ICON  = { success: '✓', partial: '~', fail: '✗' }
  const STATUS_LABEL = {
    success: 'Weekly target met',
    partial: 'Weekly target met using banked overtime',
    fail:    'Weekly target not met',
  }

  return (
    <li className={`history-week history-week--${status}`}>
      <button
        type="button"
        className="history-week-header"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span className="history-week-label">{label}</span>
        {status !== 'pending' && (
          <span
            className={`history-week-status history-week-status--${status}`}
            aria-label={STATUS_LABEL[status]}
          >
            {STATUS_ICON[status]}
          </span>
        )}
        <span className="history-total">{hoursFormat === 'hhmm' ? toHoursMinutes(totalMs) : toDecimalHours(totalMs)}h</span>
        <span className="history-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <ul className="history-days">
          {days.map(day => (
            <HistoryDay key={day.date} day={day} todayKey={todayKey} hoursFormat={hoursFormat} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function HistoryList({ allDays, todayKey, hoursFormat, daysOff = {} }: HistoryListProps) {
  const currentWeekKey = getWeekKey(todayKey)
  const [currentYear, currentMonth] = todayKey.split('-').map(Number)

  const historyDays = allDays.filter(d => !d.isOff)

  // For each week key, the cumulative overtime (ms) banked from all prior completed weeks.
  const cumulativeOvertimeMap = useMemo(() => {
    const weekData = new Map()
    for (const day of allDays) {
      if (day.isOff) continue
      const wk = getWeekKey(day.date)
      if (!weekData.has(wk)) {
        const [y, m, d] = wk.split('-').map(Number)
        const weekdays = getWeekDays(new Date(y, m - 1, d)).slice(0, 5)
        const daysOffSum = weekdays.reduce((sum, date) => sum + dayOffFraction(daysOff[toDateKey(date)]), 0)
        weekData.set(wk, { totalMs: 0, targetMs: (5 - daysOffSum) * 8 * 3600000 })
      }
      weekData.get(wk).totalMs += day.totalMs
    }
    const sorted = [...weekData.entries()].sort(([a], [b]) => a.localeCompare(b))
    const map = new Map()
    let running = 0
    for (const [wk, { totalMs, targetMs }] of sorted) {
      map.set(wk, running)
      running += totalMs - targetMs
    }
    return map
  }, [allDays, daysOff])

  const hasActiveSession = historyDays.some(d => d.sessions.some(s => s.checkOut === null))
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (!hasActiveSession) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hasActiveSession])

  const liveDays = historyDays.map(day => {
    if (!day.sessions.some(s => s.checkOut === null)) return day
    const totalMs = sumSessionsMs(day.sessions, now)
    return { ...day, totalMs, totalDecimal: toDecimalHours(totalMs) }
  })

  const weekGroups = useMemo(() => {
    // Show every week that has at least one day in the current month — a
    // Mon–Sun week intersects the current month iff its Monday or Sunday
    // falls in it. The current week is naturally included because today is
    // always in the current month.
    function weekTouchesCurrentMonth(weekKey: string) {
      const [y, m, d] = weekKey.split('-').map(Number)
      const monday = new Date(y, m - 1, d)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      const inCurrentMonth = (date: Date) =>
        date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth
      return inCurrentMonth(monday) || inCurrentMonth(sunday)
    }

    const groups = new Map()
    for (const day of liveDays) {
      const wk = getWeekKey(day.date)
      if (weekTouchesCurrentMonth(wk)) {
        if (!groups.has(wk)) groups.set(wk, [])
        groups.get(wk).push(day)
      }
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [liveDays, currentYear, currentMonth])

  if (weekGroups.length === 0) return null

  return (
    <section className="history-section">
      <h2 className="history-title">History</h2>
      <ul className="history-weeks">
        {weekGroups.map(([weekKey, days]) => (
          <HistoryWeek
            key={weekKey}
            weekKey={weekKey}
            days={days}
            todayKey={todayKey}
            hoursFormat={hoursFormat}
            defaultExpanded={weekKey === currentWeekKey}
            daysOff={daysOff}
            isCurrentWeek={weekKey === currentWeekKey}
            cumulativeOvertimeBeforeMs={cumulativeOvertimeMap.get(weekKey) ?? 0}
          />
        ))}
      </ul>
    </section>
  )
}
