import type { HolidayAccrualMode } from '../types'

function parseDateKey(str: string | null | undefined): Date | null {
  if (typeof str !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

export function computeAccruedDays(startDateKey: string | null | undefined, annualAllowance: number, today: Date = new Date(), mode: HolidayAccrualMode = 'gradual'): number {
  const allowance = Number(annualAllowance) || 0
  const year = today.getFullYear()

  const yearStart = new Date(year, 0, 1)
  const start = parseDateKey(startDateKey)
  const earnFrom = (start && start > yearStart) ? start : yearStart

  if (earnFrom > today) return 0

  // "Immediate" mode grants the full (hire-date-prorated) annual allowance
  // as soon as it's earned, instead of ratcheting it up month by month.
  if (mode === 'immediate') return computeProratedAllowance(startDateKey, allowance, year)

  const monthlyRate = allowance / 12

  // Credit is given at the end of each calendar month, once it has fully
  // elapsed. The hire month is prorated using the same fraction as
  // computeProratedAllowance so that, by Dec 31, accrued equals the
  // prorated annual allowance.
  let accrued = 0
  let y = earnFrom.getFullYear()
  let m = earnFrom.getMonth()

  const firstMonthEnd = new Date(y, m + 1, 0)
  if (firstMonthEnd > today) return 0

  const daysInFirstMonth = firstMonthEnd.getDate()
  const firstMonthFraction = (daysInFirstMonth - earnFrom.getDate() + 1) / daysInFirstMonth
  accrued += monthlyRate * firstMonthFraction
  m++
  if (m > 11) { m = 0; y++ }

  while (y <= year) {
    const monthEnd = new Date(y, m + 1, 0)
    if (monthEnd > today) break
    accrued += monthlyRate
    m++
    if (m > 11) { m = 0; y++ }
  }

  return accrued
}

export function computeProratedAllowance(startDateKey: string | null | undefined, annualAllowance: number, year: number = new Date().getFullYear()): number {
  const allowance = Number(annualAllowance) || 0
  const start = parseDateKey(startDateKey)
  if (!start) return allowance

  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)

  if (start <= yearStart) return allowance
  if (start > yearEnd) return 0

  const startMonth = start.getMonth()
  const startDay = start.getDate()
  const daysInStartMonth = new Date(year, startMonth + 1, 0).getDate()
  const partialStartMonth = (daysInStartMonth - startDay + 1) / daysInStartMonth
  const fullMonthsRemaining = 11 - startMonth
  const monthsRemaining = partialStartMonth + fullMonthsRemaining

  return (allowance * monthsRemaining) / 12
}

export function formatHolidayDays(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const floored = Math.floor(n * 10) / 10
  if (Number.isInteger(floored)) return String(floored)
  return floored.toFixed(1)
}
