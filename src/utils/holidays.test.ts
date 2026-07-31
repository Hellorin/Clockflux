import { describe, it, expect } from 'vitest'
import { computeAccruedDays, computeProratedAllowance, formatHolidayDays } from './holidays'

describe('computeProratedAllowance', () => {
  it('returns the full allowance when hired before the year starts', () => {
    expect(computeProratedAllowance('2020-01-01', 25, 2024)).toBe(25)
  })

  it('returns 0 when hired after the year ends', () => {
    expect(computeProratedAllowance('2025-01-01', 25, 2024)).toBe(0)
  })

  it('prorates for a mid-year hire date', () => {
    // Hired July 1 2024 -> 6 of 12 months remaining in the year
    const result = computeProratedAllowance('2024-07-01', 24, 2024)
    expect(result).toBe(12)
  })
})

describe('computeAccruedDays', () => {
  it('accrues nothing before the start date', () => {
    expect(computeAccruedDays('2024-06-01', 24, new Date(2024, 0, 1))).toBe(0)
  })

  it('accrues the full year by year end in gradual mode', () => {
    const accrued = computeAccruedDays('2024-01-01', 24, new Date(2024, 11, 31))
    expect(accrued).toBeCloseTo(24, 0)
  })

  it('grants the prorated allowance immediately in immediate mode', () => {
    const accrued = computeAccruedDays('2024-01-01', 24, new Date(2024, 2, 1), 'immediate')
    expect(accrued).toBe(24)
  })
})

describe('formatHolidayDays', () => {
  it('formats whole numbers without decimals', () => {
    expect(formatHolidayDays(12)).toBe('12')
  })

  it('formats fractional numbers to one decimal', () => {
    expect(formatHolidayDays(12.34)).toBe('12.3')
  })

  it('falls back to 0 for non-finite input', () => {
    expect(formatHolidayDays(NaN)).toBe('0')
  })
})
