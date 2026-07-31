import { computeAccruedDays, computeProratedAllowance } from '../utils/holidays'
import { dayOffBaseType, dayOffFraction } from '../utils/dayOff'
import { getTodayKey } from '../utils/time'
import type { DaysOffMap, HolidayAccrualMode } from '../types'

export function getAccruedDays(startDateKey: string | null | undefined, annualAllowance: number, today: Date = new Date(), mode: HolidayAccrualMode = 'gradual'): number {
  return computeAccruedDays(startDateKey, annualAllowance, today, mode)
}

export function getProratedAllowance(startDateKey: string | null | undefined, annualAllowance: number, year: number = new Date().getFullYear()): number {
  return computeProratedAllowance(startDateKey, annualAllowance, year)
}

// Sum of 'personal' days off consumed so far this year (half days count as 0.5).
export function getPersonalDaysUsedThisYear(daysOff: DaysOffMap, referenceDate: Date = new Date()): number {
  const prefix = `${referenceDate.getFullYear()}-`
  const todayKey = getTodayKey()
  let n = 0
  for (const [k, v] of Object.entries(daysOff)) {
    if (dayOffBaseType(v) === 'personal' && k.startsWith(prefix) && k <= todayKey) n += dayOffFraction(v)
  }
  return n
}

export function getBalance(startDateKey: string | null | undefined, annualAllowance: number, daysOff: DaysOffMap, mode: HolidayAccrualMode = 'gradual', today: Date = new Date()): number {
  return getAccruedDays(startDateKey, annualAllowance, today, mode) - getPersonalDaysUsedThisYear(daysOff, today)
}
