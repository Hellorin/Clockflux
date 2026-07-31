import { useMemo, useState } from 'react'
import { computeRecentWeeklyAvg } from '../utils/stats'
import type { RecentWeeklyAvgStatus, WeeklyTotal } from '../utils/stats'
import { decimalToHoursMinutes } from '../utils/time'
import { formatHolidayDays } from '../utils/holidays'
import OvertimeChart from './OvertimeChart'
import type { DayEntry } from '../hooks/useTimeTracker'
import type { GlobalStats } from '../utils/stats'
import type { DaysOffMap } from '../types'

interface HealthPageProps {
  stats: GlobalStats | null
  allDays: DayEntry[]
  daysOff: DaysOffMap
  employmentStartDate: string | null
}

const STATUS_CONFIG: Record<RecentWeeklyAvgStatus, { icon: string, message: string, modifier: string }> = {
  empty: {
    icon: '📊',
    message: 'Keep tracking — your health score will appear after your first full week',
    modifier: 'neutral',
  },
  'no-data': {
    icon: '📊',
    message: 'Keep tracking — your health score will appear after your first full week',
    modifier: 'neutral',
  },
  'too-much': {
    icon: '😰',
    message: 'Take it easy, this is about your health',
    modifier: 'danger',
  },
  ok: {
    icon: '💚',
    message: 'Great, keep up the good work',
    modifier: 'ok',
  },
  'not-enough': {
    icon: '⚠️',
    message: "Maybe you should make sure you are doing enough and don't get in trouble",
    modifier: 'warn',
  },
}

export default function HealthPage({ stats, allDays, daysOff, employmentStartDate }: HealthPageProps) {
  const healthData = useMemo(() => {
    const days = Object.fromEntries(allDays.map(d => [d.date, d.sessions]))
    return computeRecentWeeklyAvg(days, daysOff)
  }, [allDays, daysOff])

  const lastOvertimeDate = useMemo(() => {
    const series = healthData.cumulativeOvertimeSeries
    if (!series || series.length === 0) return null
    const lastWeekKey = series[series.length - 1].weekKey
    const [yr, mo, dy] = lastWeekKey.split('-').map(Number)
    const friday = new Date(yr, mo - 1, dy + 4)
    return friday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }, [healthData])

  const lastDayUpdated = useMemo(() => {
    const daysWithData = allDays.filter(day => day.sessions && day.sessions.length > 0)
    if (daysWithData.length === 0) return null
    const maxKey = daysWithData.reduce((max, day) => day.date > max ? day.date : max, daysWithData[0].date)
    const [yr, mo, dy] = maxKey.split('-').map(Number)
    return new Date(yr, mo - 1, dy).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }, [allDays])

  const dailyAvgSince = useMemo(() => {
    const year = new Date().getFullYear()
    if (employmentStartDate) {
      const [yr, mo, dy] = employmentStartDate.split('-').map(Number)
      if (yr === year) {
        return new Date(yr, mo - 1, dy).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      }
    }
    return new Date(year, 0, 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }, [employmentStartDate])

  const [showGuide, setShowGuide] = useState(false)

  if (!stats || stats.isEmpty) {
    return (
      <section className="health-page health-page--empty">
        <div className="stats-empty">
          <div className="stats-empty__icon">🫀</div>
          <p className="stats-empty__title">No data yet</p>
          <p className="stats-empty__sub">Start tracking your hours to get health insights here.</p>
        </div>
      </section>
    )
  }

  const { weekCount, status, cumulativeOvertimeHours, cumulativeOvertimeSeries, recentWeeks } = healthData
  const cfg = STATUS_CONFIG[status]
  const dailyAvg = stats.averages.avgHoursPerWorkday

  const weekNoun = weekCount === 1 ? 'week' : 'weeks'
  const avgLabel = weekCount > 0
    ? `Based on your last ${weekCount} completed ${weekNoun}`
    : 'Based on your overall daily average'

  return (
    <section className="health-page">
      <div className={`health-status-card health-status-card--${cfg.modifier}`}>
        <div className="health-status-card__icon">{cfg.icon}</div>
        <p className="health-status-card__message">{cfg.message}</p>
        <p className="health-status-card__sub">{avgLabel}</p>
        <button
            type="button"
            className="health-guide-btn"
            onClick={() => setShowGuide(true)}
            aria-label="What do these thresholds mean?"
        >
          ?
        </button>
      </div>

      {showGuide && (
          <div className="health-guide-overlay">
            <button type="button" className="health-guide-overlay__scrim" onClick={() => setShowGuide(false)} aria-label="Close dialog" />
            <div className="health-guide-popover" role="dialog" aria-modal="true" aria-label="What the thresholds mean">
              <div className="health-guide-popover__header">
                <span className="health-guide-popover__title">What the thresholds mean</span>
                <button type="button" className="health-guide-popover__close" onClick={() => setShowGuide(false)} aria-label="Close">✕</button>
              </div>
              <ul className="health-guide__list">
                <li className="health-guide__item health-guide__item--ok">
                  <span className="health-guide__dot" />
                  <span><strong>On track</strong> — 100–112% of your weekly target (e.g. 40–45 h on a full week)</span>
                </li>
                <li className="health-guide__item health-guide__item--warn">
                  <span className="health-guide__dot" />
                  <span><strong>Under</strong> — below your weekly target. Could signal a risk.</span>
                </li>
                <li className="health-guide__item health-guide__item--danger">
                  <span className="health-guide__dot" />
                  <span><strong>Over</strong> — more than 112% of your target. Sustained overtime can hurt.</span>
                </li>
              </ul>
            </div>
          </div>
      )}

      {cumulativeOvertimeSeries && cumulativeOvertimeSeries.length >= 2 && (
        <div className="overtime-chart-card">
          <div className="overtime-chart-card__header">
            <p className="overtime-chart-card__title">Cumulative overtime over time</p>
            {lastOvertimeDate && <span className="overtime-chart-card__updated">Updated {lastOvertimeDate}</span>}
          </div>
          <OvertimeChart series={cumulativeOvertimeSeries} />
        </div>
      )}

      <div className="health-metrics">
        <HealthMetric
          label="Daily average"
          value={decimalToHoursMinutes(dailyAvg)}
          sub="per workday"
          updatedAt={dailyAvgSince}
          updatedLabel="Since"
        />
        <HealthMetric
          label="Cumulative overtime"
          value={(cumulativeOvertimeHours >= 0 ? '+' : '-') + decimalToHoursMinutes(Math.abs(cumulativeOvertimeHours))}
          sub="across all completed weeks"
          modifier={cumulativeOvertimeHours >= 0 ? 'positive' : 'negative'}
          updatedAt={lastOvertimeDate ?? lastDayUpdated}
        />
      </div>

      <WeekBreakdown weeks={recentWeeks} />
    </section>
  )
}

interface HealthMetricProps {
  label: string
  value: string
  sub: string
  modifier?: string
  updatedAt?: string | null
  updatedLabel?: string
}

function HealthMetric({ label, value, sub, modifier, updatedAt, updatedLabel = 'Updated' }: HealthMetricProps) {
  const modifierClass = modifier ? ` health-metric__value--${modifier}` : ''
  return (
    <div className="health-metric">
      <span className={`health-metric__value${modifierClass}`}>{value}</span>
      <span className="health-metric__label">{label}</span>
      <span className="health-metric__sub">{sub}</span>
      {updatedAt && <span className="health-metric__updated">{updatedLabel} {updatedAt}</span>}
    </div>
  )
}

function formatWeekLabel(monday: Date): string {
  return monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function WeekBreakdown({ weeks }: { weeks: WeeklyTotal[] | undefined }) {
  if (!weeks || weeks.length === 0) return null
  return (
    <div className="week-breakdown">
      <p className="week-breakdown__title">Recent weeks</p>
      <ul className="week-breakdown__list">
        {weeks.map(w => {
          const daysOff = w.target < 40 ? (40 - w.target) / 8 : 0
          const ok = w.hours >= w.target
          return (
            <li key={w.mondayKey} className={`week-breakdown__row week-breakdown__row--${ok ? 'ok' : 'warn'}`}>
              <span className="week-breakdown__dot" />
              <span className="week-breakdown__date">{formatWeekLabel(w.mondayDate)}</span>
              <span className="week-breakdown__hours">{decimalToHoursMinutes(w.hours)}</span>
              <span className="week-breakdown__sep">/</span>
              <span className="week-breakdown__target">
                {decimalToHoursMinutes(w.target)}
                {daysOff > 0 && <span className="week-breakdown__note"> ({formatHolidayDays(daysOff)}d off)</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
