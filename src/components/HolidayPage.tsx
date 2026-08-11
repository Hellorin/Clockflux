import { useMemo } from 'react'
import { getTodayKey } from '../utils/time'
import { formatHolidayDays } from '../utils/holidays'
import { dayOffBaseType, dayOffFraction } from '../utils/dayOff'
import { getProratedAllowance, getAccruedDays } from '../services/ptoService'
import HolidayChart from './HolidayChart'
import type { DaysOffMap, HolidayAccrualMode } from '../types'

interface HolidayPageProps {
  used: number
  daysOff: DaysOffMap
  allowance: number
  startDate: string | null
  accrualMode: HolidayAccrualMode
}

export default function HolidayPage({ used, daysOff, allowance, startDate, accrualMode }: HolidayPageProps) {
  return (
    <section className="holiday-page">
      <HolidayBalanceCard
        used={used}
        daysOff={daysOff}
        allowance={allowance}
        startDate={startDate}
        accrualMode={accrualMode}
      />
    </section>
  )
}

function HolidayBalanceCard({ used, daysOff, allowance, startDate, accrualMode }: HolidayPageProps) {
  const year = useMemo(() => new Date().getFullYear(), [])
  const todayKey = getTodayKey()

  const proratedAllowance = getProratedAllowance(startDate, allowance, year)
  const accrued = getAccruedDays(startDate, allowance, new Date(), accrualMode)
  const isProrated = startDate && proratedAllowance !== allowance
  const available = accrued - used
  const overspent = available < 0
  const pct = accrued > 0 ? Math.min(100, (used / accrued) * 100) : 0

  const planned = useMemo(() =>
    Object.entries(daysOff)
      .filter(([k, v]) => dayOffBaseType(v) === 'personal' && k > todayKey && k.startsWith(`${year}-`))
      .reduce((sum, [, v]) => sum + dayOffFraction(v), 0)
  , [daysOff, todayKey, year])

  const projected = used + planned
  const yearEndSurplus = proratedAllowance - projected

  let badgeClass, badgeText
  if (yearEndSurplus < 0) {
    badgeClass = 'over'
    badgeText = `⚠ ${formatHolidayDays(Math.abs(yearEndSurplus))} days over by year end`
  } else {
    badgeClass = 'ok'
    badgeText = `✓ ${formatHolidayDays(yearEndSurplus)} days to spare`
  }

  return (
    <div className={`holiday-card${overspent ? ' holiday-card--over' : ''}`}>
      <div className="holiday-card__header">
        <span className="holiday-card__title">Holiday balance</span>
        <span className="holiday-card__year">{year}</span>
      </div>
      <div className="holiday-card__numbers">
        <span className="holiday-card__used">{formatHolidayDays(Math.max(0, available))}</span>
        <span className="holiday-card__allowance-wrap">
          <span className="holiday-card__allowance-suffix">days available</span>
        </span>
      </div>
      <p className="holiday-card__sub">
        {overspent
          ? `${formatHolidayDays(Math.abs(available))} days ahead of your accrual`
          : `${formatHolidayDays(accrued)} earned so far · ${formatHolidayDays(used)} used`}
      </p>
      <div className="holiday-card__bar-track">
        <div className="holiday-card__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="holiday-card__sub">
        Total this year: <strong>{formatHolidayDays(proratedAllowance)}</strong> days{isProrated ? ' (prorated)' : ''}
      </p>
      <div className="holiday-card__projection">
        <div className="holiday-card__projection-header">
          <span className="holiday-card__projection-label">Year-end projection</span>
          <span className={`holiday-card__projection-badge holiday-card__projection-badge--${badgeClass}`}>
            {badgeText}
          </span>
        </div>
        <p className="holiday-card__sub">
          {formatHolidayDays(used)} used + {formatHolidayDays(planned)} planned = {formatHolidayDays(projected)} of {formatHolidayDays(proratedAllowance)} days
        </p>
      </div>
      <HolidayChart daysOff={daysOff} allowance={allowance} startDate={startDate} accrualMode={accrualMode} />
    </div>
  )
}
