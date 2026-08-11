import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAppSettings } from './useAppSettings'

describe('useAppSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads defaults when nothing is stored', () => {
    const { result } = renderHook(() => useAppSettings())
    expect(result.current.settings).toEqual({
      annualHolidayAllowance: 25,
      employmentStartDate: null,
      holidayAccrualMode: 'gradual',
      themeLightColor: null,
      themeDarkColor: null,
    })
  })

  it('loads persisted settings merged with defaults', () => {
    localStorage.setItem('timeforgeSettings', JSON.stringify({ annualHolidayAllowance: 30 }))
    const { result } = renderHook(() => useAppSettings())
    expect(result.current.settings.annualHolidayAllowance).toBe(30)
    expect(result.current.settings.holidayAccrualMode).toBe('gradual')
  })

  it('falls back to defaults when stored JSON is corrupt', () => {
    localStorage.setItem('timeforgeSettings', '{not json')
    const { result } = renderHook(() => useAppSettings())
    expect(result.current.settings.annualHolidayAllowance).toBe(25)
  })

  it('sets and persists the annual holiday allowance, flooring and clamping to 0', () => {
    const { result } = renderHook(() => useAppSettings())
    act(() => result.current.setAnnualHolidayAllowance(20.9))
    expect(result.current.settings.annualHolidayAllowance).toBe(20)

    act(() => result.current.setAnnualHolidayAllowance(-5))
    expect(result.current.settings.annualHolidayAllowance).toBe(0)

    act(() => result.current.setAnnualHolidayAllowance('not-a-number'))
    expect(result.current.settings.annualHolidayAllowance).toBe(0)

    const stored = JSON.parse(localStorage.getItem('timeforgeSettings')!)
    expect(stored.annualHolidayAllowance).toBe(0)
  })

  it('sets a valid employment start date', () => {
    const { result } = renderHook(() => useAppSettings())
    act(() => result.current.setEmploymentStartDate('2024-05-01'))
    expect(result.current.settings.employmentStartDate).toBe('2024-05-01')
  })

  it('rejects malformed employment start dates and clears to null', () => {
    const { result } = renderHook(() => useAppSettings())
    act(() => result.current.setEmploymentStartDate('not-a-date'))
    expect(result.current.settings.employmentStartDate).toBeNull()
  })

  it('sets holiday accrual mode to immediate or gradual, defaulting unknown values to gradual', () => {
    const { result } = renderHook(() => useAppSettings())
    act(() => result.current.setHolidayAccrualMode('immediate'))
    expect(result.current.settings.holidayAccrualMode).toBe('immediate')

    act(() => result.current.setHolidayAccrualMode('bogus'))
    expect(result.current.settings.holidayAccrualMode).toBe('gradual')
  })

  it('sets valid theme colors and rejects malformed ones', () => {
    const { result } = renderHook(() => useAppSettings())
    act(() => result.current.setThemeLightColor('#fffbf5'))
    expect(result.current.settings.themeLightColor).toBe('#fffbf5')

    act(() => result.current.setThemeDarkColor('#1a1a2e'))
    expect(result.current.settings.themeDarkColor).toBe('#1a1a2e')

    act(() => result.current.setThemeLightColor('not-a-color'))
    expect(result.current.settings.themeLightColor).toBeNull()

    act(() => result.current.setThemeDarkColor(null))
    expect(result.current.settings.themeDarkColor).toBeNull()
  })
})
