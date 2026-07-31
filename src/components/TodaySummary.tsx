import { useState, useEffect } from 'react'
import { sumSessionsMs, toDecimalHours, toHoursMinutes } from '../utils/time'
import type { HoursFormat, Session } from '../types'

interface TodaySummaryProps {
  todaySessions: Session[]
  hoursFormat: HoursFormat
  onToggleFormat: () => void
  isTodayOff: boolean
  todayTargetMs?: number
  weekTargetMs: number
  weekTotalOtherDaysMs: number
  allPastWorkdayOvertimeMs?: number
}

interface SummaryInput {
  todaySessions: Session[]
  hoursFormat: HoursFormat
  isTodayOff: boolean
  todayTargetMs: number
  weekTargetMs: number
  weekTotalOtherDaysMs: number
  allPastWorkdayOvertimeMs: number
  now: number
}

function formatMsLeft(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}

// Live week remaining: all in ms, truncated to the minute for display.
// Overtime as of today: cumulative all-time past overtime + today's live hours vs today's target
// (zeroed on a day off).
function computeSummary({ todaySessions, hoursFormat, isTodayOff, todayTargetMs, weekTargetMs, weekTotalOtherDaysMs, allPastWorkdayOvertimeMs, now }: SummaryInput) {
  const showDaily = !isTodayOff && todaySessions.length > 0
  const showWeek = weekTargetMs > 0
  if (!showDaily && !showWeek) return null

  const totalMs = showDaily ? sumSessionsMs(todaySessions, now) : 0
  const displayTotal = hoursFormat === 'hhmm' ? toHoursMinutes(totalMs) : toDecimalHours(totalMs)
  const sessionCount = todaySessions.length

  const todayMs = isTodayOff ? 0 : totalMs
  const weekTotalMs = weekTotalOtherDaysMs + todayMs
  const weekRemainingMs = Math.max(0, weekTargetMs - weekTotalMs)
  const weekDone = weekRemainingMs === 0
  const weekPct = Math.min(100, weekTargetMs > 0 ? (weekTotalMs / weekTargetMs) * 100 : 0)

  const todayOvertimeMs = !isTodayOff ? allPastWorkdayOvertimeMs + todayMs - todayTargetMs : 0
  const showTodayOvertime = !isTodayOff && todaySessions.length > 0 && Math.abs(todayOvertimeMs) >= 60000

  return { showDaily, showWeek, displayTotal, sessionCount, weekRemainingMs, weekDone, weekPct, showTodayOvertime, todayOvertimeMs }
}

interface DailyTotalProps {
  displayTotal: number | string
  sessionCount: number
  hoursFormat: HoursFormat
  onToggleFormat: () => void
}

function DailyTotal({ displayTotal, sessionCount, hoursFormat, onToggleFormat }: DailyTotalProps) {
  return (
    <>
      <div className="today-total">{displayTotal}</div>
      <div className="today-label">
        hours today &middot; {sessionCount} session{sessionCount !== 1 ? 's' : ''}
      </div>
      <button type="button" className="format-toggle" onClick={onToggleFormat} title="Toggle hours format">
        {hoursFormat === 'decimal' ? '8:MM' : '8.25'}
      </button>
    </>
  )
}

interface WeekProgressProps {
  showDaily: boolean
  weekDone: boolean
  weekRemainingMs: number
  weekPct: number
  showTodayOvertime: boolean
  todayOvertimeMs: number
}

function WeekProgress({ showDaily, weekDone, weekRemainingMs, weekPct, showTodayOvertime, todayOvertimeMs }: WeekProgressProps) {
  return (
    <div className={`week-remaining${showDaily ? ' week-remaining--with-separator' : ''}`}>
      {weekDone ? (
        <span className="week-remaining__done">Week complete!</span>
      ) : (
        <span className="week-remaining__label">
          <strong>{formatMsLeft(weekRemainingMs)}</strong> left this week
        </span>
      )}
      <div className="week-bar-track">
        <div
          className={`week-bar-fill${weekDone ? ' week-bar-fill--done' : ''}`}
          style={{ width: `${weekPct}%` }}
        />
      </div>
      {showTodayOvertime && (
        <div className={`week-overtime${todayOvertimeMs > 0 ? ' week-overtime--ahead' : ' week-overtime--behind'}`}>
          {todayOvertimeMs > 0 ? `+${formatMsLeft(todayOvertimeMs)} overtime` : `${formatMsLeft(-todayOvertimeMs)} behind pace`}
          <span className="week-overtime__label"> · so far today</span>
        </div>
      )}
    </div>
  )
}

export default function TodaySummary({ todaySessions, hoursFormat, onToggleFormat, isTodayOff, todayTargetMs = 8 * 3600000, weekTargetMs, weekTotalOtherDaysMs, allPastWorkdayOvertimeMs = 0 }: TodaySummaryProps) {
  const isCheckedIn = todaySessions.length > 0 && !todaySessions[todaySessions.length - 1].checkOut
  const now = useNow(isCheckedIn ? 1000 : 30000)

  const summary = computeSummary({ todaySessions, hoursFormat, isTodayOff, todayTargetMs, weekTargetMs, weekTotalOtherDaysMs, allPastWorkdayOvertimeMs, now })
  if (!summary) return null

  const { showDaily, showWeek, displayTotal, sessionCount, weekRemainingMs, weekDone, weekPct, showTodayOvertime, todayOvertimeMs } = summary

  return (
    <div className="today-summary">
      {showDaily && (
        <DailyTotal displayTotal={displayTotal} sessionCount={sessionCount} hoursFormat={hoursFormat} onToggleFormat={onToggleFormat} />
      )}

      {showWeek && (
        <WeekProgress
          showDaily={showDaily}
          weekDone={weekDone}
          weekRemainingMs={weekRemainingMs}
          weekPct={weekPct}
          showTodayOvertime={showTodayOvertime}
          todayOvertimeMs={todayOvertimeMs}
        />
      )}
    </div>
  )
}
