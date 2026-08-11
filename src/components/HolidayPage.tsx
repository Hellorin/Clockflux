import { useMemo } from 'react'
import { getTodayKey } from '../utils/time'
import { formatHolidayDays } from '../utils/holidays'
import { dayOffBaseType, dayOffFraction } from '../utils/dayOff'
import { getProratedAllowance, getAccruedDays, getCarryoverDays } from '../services/ptoService'
import HolidayChart from './HolidayChart'
import type { DaysOffMap, HolidayAccrualMode } from '../types'

interface HolidayPageProps {
  used: number
  daysOff: DaysOffMap
  allowance: number
  startDate: string | null
  accrualMode: HolidayAccrualMode
  /** Days unused at the end of last year, carried into this year's balance (Pro "holiday-carryover" feature) — true only once the user has also switched it on in Settings. */
  carryoverEnabled?: boolean
  /** Whether the caller's plan unlocks holiday carryover at all, regardless of whether they've switched it on yet. Distinguishes "Pro, but off" from "not Pro" in the note below. */
  carryoverAvailable?: boolean
  /** Whether paid-plan gating is active at all (i.e. VITE_ENABLE_PAID_FEATURES). When false there's no Free/Pro distinction to report, so the note below is omitted entirely instead of defaulting to the "Free plan" message. */
  planGatingActive?: boolean
}

export default function HolidayPage({ used, daysOff, allowance, startDate, accrualMode, carryoverEnabled = false, carryoverAvailable = false, planGatingActive = false }: HolidayPageProps) {
  return (
    <section className="holiday-page">
      <HolidayBalanceCard
        used={used}
        daysOff={daysOff}
        allowance={allowance}
        startDate={startDate}
        accrualMode={accrualMode}
        carryoverEnabled={carryoverEnabled}
        carryoverAvailable={carryoverAvailable}
        planGatingActive={planGatingActive}
      />
    </section>
  )
}

function HolidayBalanceCard({ used, daysOff, allowance, startDate, accrualMode, carryoverEnabled = false, carryoverAvailable = false, planGatingActive = false }: HolidayPageProps) {
  const year = useMemo(() => new Date().getFullYear(), [])
  const todayKey = getTodayKey()

  const proratedAllowance = getProratedAllowance(startDate, allowance, year)
  const accrued = getAccruedDays(startDate, allowance, new Date(), accrualMode)
  const carryover = getCarryoverDays(startDate, allowance, daysOff, carryoverEnabled, year)
  const isProrated = startDate && proratedAllowance !== allowance
  const available = accrued + carryover - used
  const overspent = available < 0
  const pct = (accrued + carryover) > 0 ? Math.min(100, (used / (accrued + carryover)) * 100) : 0

  const planned = useMemo(() =>
    Object.entries(daysOff)
      .filter(([k, v]) => dayOffBaseType(v) === 'personal' && k > todayKey && k.startsWith(`${year}-`))
      .reduce((sum, [, v]) => sum + dayOffFraction(v), 0)
  , [daysOff, todayKey, year])

  const projected = used + planned
  const totalAllowance = proratedAllowance + carryover
  const yearEndSurplus = totalAllowance - projected

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
          : `${formatHolidayDays(accrued)} earned so far${carryover > 0 ? ` + ${formatHolidayDays(carryover)} carried over` : ''} · ${formatHolidayDays(used)} used`}
      </p>
      <div className="holiday-card__bar-track">
        <div className="holiday-card__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="holiday-card__sub">
        Total this year: <strong>{formatHolidayDays(totalAllowance)}</strong> days{isProrated ? ' (prorated)' : ''}{carryover > 0 ? ` (incl. ${formatHolidayDays(carryover)} carried over)` : ''}
      </p>
      <div className="holiday-card__projection">
        <div className="holiday-card__projection-header">
          <span className="holiday-card__projection-label">Year-end projection</span>
          <span className={`holiday-card__projection-badge holiday-card__projection-badge--${badgeClass}`}>
            {badgeText}
          </span>
        </div>
        <p className="holiday-card__sub">
          {formatHolidayDays(used)} used + {formatHolidayDays(planned)} planned = {formatHolidayDays(projected)} of {formatHolidayDays(totalAllowance)} days
        </p>
      </div>
      {carryoverEnabled ? (
        <p className="settings-note holiday-carryover-note">
          <span className="settings-sync-star" aria-hidden="true">✦</span> Your unused days will carry over into the new year
        </p>
      ) : planGatingActive && carryoverAvailable ? (
        <p className="settings-note holiday-carryover-note">
          <span className="settings-sync-star" aria-hidden="true">✦</span> Pro: turn on carryover in Settings to keep your unused days next year
        </p>
      ) : planGatingActive ? (
        <p className="settings-note holiday-carryover-note">
          Free plan: unused days don't carry over — <span className="settings-sync-star" aria-hidden="true">✦</span> Pro carries them into the new year.
        </p>
      ) : null}
      <HolidayChart daysOff={daysOff} allowance={allowance} startDate={startDate} accrualMode={accrualMode} carryoverDays={carryover} />
    </div>
  )
}
