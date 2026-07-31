import { describe, it, expect } from 'vitest'
import {
  isValidDayOffType,
  isHalfDayOff,
  dayOffFraction,
  dayOffBaseType,
  getDayOffMeta,
} from './dayOff'
import type { DayOffType } from '../types'

describe('isValidDayOffType', () => {
  it('accepts full and half-day variants of allowed types', () => {
    expect(isValidDayOffType('personal')).toBe(true)
    expect(isValidDayOffType('personal-half')).toBe(true)
    expect(isValidDayOffType('official')).toBe(true)
  })

  it('rejects half-day variants for types that do not allow it', () => {
    expect(isValidDayOffType('official-half')).toBe(false)
  })

  it('rejects unknown types', () => {
    expect(isValidDayOffType('vacation')).toBe(false)
  })
})

describe('isHalfDayOff', () => {
  it('detects the -half suffix', () => {
    expect(isHalfDayOff('sick-half')).toBe(true)
    expect(isHalfDayOff('sick')).toBe(false)
    expect(isHalfDayOff(undefined)).toBe(false)
  })
})

describe('dayOffFraction', () => {
  it('returns 0 for unset, 0.5 for half days, 1 for full days', () => {
    expect(dayOffFraction(undefined)).toBe(0)
    expect(dayOffFraction('unpaid-half')).toBe(0.5)
    expect(dayOffFraction('unpaid')).toBe(1)
  })
})

describe('dayOffBaseType', () => {
  it('strips the half-day suffix', () => {
    expect(dayOffBaseType('personal-half')).toBe('personal')
    expect(dayOffBaseType('personal')).toBe('personal')
  })
})

describe('getDayOffMeta', () => {
  it('finds metadata regardless of half-day suffix', () => {
    expect(getDayOffMeta('sick-half')!.label).toBe('Sick')
    expect(getDayOffMeta('sick')!.label).toBe('Sick')
  })

  it('returns undefined for unknown types', () => {
    expect(getDayOffMeta('vacation' as DayOffType)).toBeUndefined()
  })
})
