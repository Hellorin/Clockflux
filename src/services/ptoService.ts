import { computeAccruedDays, computeProratedAllowance, computeCarryoverDays } from '../utils/holidays'
import { dayOffBaseType, dayOffFraction } from '../utils/dayOff'
import { getTodayKey } from '../utils/time'
import type { DaysOffMap, HolidayAccrualMode } from '../types'

export function getAccruedDays(startDateKey: string | null | undefined, annualAllowance: number, today: Date = new Date(), mode: HolidayAccrualMode = 'gradual'): number {
  return computeAccruedDays(startDateKey, annualAllowance, today, mode)
}

export function getProratedAllowance(startDateKey: string | null | undefined, annualAllowance: number, year: number = new Date().getFullYear()): number {
  return computeProratedAllowance(startDateKey, annualAllowance, year)
}

// Sum of 'personal' days off consumed in a given calendar year (half days
// count as 0.5), capped at today for the current year so future-dated
// entries in the current year count as "planned", not "used". Past years
// are unaffected by the cutoff since every one of their dates already
// precedes today.
export function getPersonalDaysUsedForYear(daysOff: DaysOffMap, year: number): number {
  const prefix = `${year}-`
  const todayKey = getTodayKey()
  let n = 0
  for (const [k, v] of Object.entries(daysOff)) {
    if (dayOffBaseType(v) === 'personal' && k.startsWith(prefix) && k <= todayKey) n += dayOffFraction(v)
  }
  return n
}

// Sum of 'personal' days off consumed so far this year (half days count as 0.5).
export function getPersonalDaysUsedThisYear(daysOff: DaysOffMap, referenceDate: Date = new Date()): number {
  return getPersonalDaysUsedForYear(daysOff, referenceDate.getFullYear())
}

// Unused balance rolled in from the previous year (Pro "holiday-carryover"
// feature). Returns 0 when the feature/setting is off, so callers can add
// this straight into a balance unconditionally.
export function getCarryoverDays(startDateKey: string | null | undefined, annualAllowance: number, daysOff: DaysOffMap, carryoverEnabled: boolean, year: number = new Date().getFullYear()): number {
  if (!carryoverEnabled) return 0
  const priorYear = year - 1
  const priorYearUsed = getPersonalDaysUsedForYear(daysOff, priorYear)
  return computeCarryoverDays(startDateKey, annualAllowance, priorYearUsed, priorYear)
}

export function getBalance(startDateKey: string | null | undefined, annualAllowance: number, daysOff: DaysOffMap, mode: HolidayAccrualMode = 'gradual', today: Date = new Date(), carryoverEnabled: boolean = false): number {
  const carryover = getCarryoverDays(startDateKey, annualAllowance, daysOff, carryoverEnabled, today.getFullYear())
  return getAccruedDays(startDateKey, annualAllowance, today, mode) + carryover - getPersonalDaysUsedThisYear(daysOff, today)
}
