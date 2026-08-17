import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAppSettings } from './useAppSettings'
import * as settingsSyncService from '../services/settingsSyncService'

vi.mock('../services/settingsSyncService')

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
      dailyTargetHours: 8,
      holidayCarryoverEnabled: false,
    })
  })

  it('loads persisted settings merged with defaults', () => {
    localStorage.setItem('appSettings', JSON.stringify({ annualHolidayAllowance: 30 }))
    const { result } = renderHook(() => useAppSettings())
    expect(result.current.settings.annualHolidayAllowance).toBe(30)
    expect(result.current.settings.holidayAccrualMode).toBe('gradual')
  })

  it('falls back to defaults when stored JSON is corrupt', () => {
    localStorage.setItem('appSettings', '{not json')
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

    const stored = JSON.parse(localStorage.getItem('appSettings')!)
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

  it('sets and persists the daily target hours, clamping to 0', () => {
    const { result } = renderHook(() => useAppSettings())
    act(() => result.current.setDailyTargetHours(6.5))
    expect(result.current.settings.dailyTargetHours).toBe(6.5)

    act(() => result.current.setDailyTargetHours(-3))
    expect(result.current.settings.dailyTargetHours).toBe(0)

    act(() => result.current.setDailyTargetHours('not-a-number'))
    expect(result.current.settings.dailyTargetHours).toBe(0)

    const stored = JSON.parse(localStorage.getItem('appSettings')!)
    expect(stored.dailyTargetHours).toBe(0)
  })

  it('sets and persists holiday carryover enabled, coercing to a boolean', () => {
    const { result } = renderHook(() => useAppSettings())
    act(() => result.current.setHolidayCarryoverEnabled(true))
    expect(result.current.settings.holidayCarryoverEnabled).toBe(true)

    const stored = JSON.parse(localStorage.getItem('appSettings')!)
    expect(stored.holidayCarryoverEnabled).toBe(true)

    act(() => result.current.setHolidayCarryoverEnabled(false))
    expect(result.current.settings.holidayCarryoverEnabled).toBe(false)
  })

  it('makes no network calls when signed out (no accessToken)', async () => {
    const { result } = renderHook(() => useAppSettings())
    await act(async () => {
      result.current.setDailyTargetHours(6)
      await Promise.resolve()
    })
    expect(settingsSyncService.getServerSettings).not.toHaveBeenCalled()
    expect(settingsSyncService.putServerSettings).not.toHaveBeenCalled()
  })

  describe('signed in (accessToken present)', () => {
    it('adopts the server-saved settings on mount, overriding the local cache', async () => {
      localStorage.setItem('appSettings', JSON.stringify({ dailyTargetHours: 6, themeLightColor: '#fffbf5' }))
      vi.mocked(settingsSyncService.getServerSettings).mockResolvedValue({
        annualHolidayAllowance: 25,
        employmentStartDate: null,
        holidayAccrualMode: 'gradual',
        themeLightColor: null,
        themeDarkColor: null,
        dailyTargetHours: 8,
        holidayCarryoverEnabled: false,
      })

      const { result } = renderHook(() => useAppSettings('token-123'))
      await act(async () => {
        await Promise.resolve()
      })

      expect(settingsSyncService.getServerSettings).toHaveBeenCalledWith('token-123')
      // The server's (free-plan) truth wins over the locally cached Pro-looking values.
      expect(result.current.settings.dailyTargetHours).toBe(8)
      expect(result.current.settings.themeLightColor).toBeNull()
      expect(JSON.parse(localStorage.getItem('appSettings')!).dailyTargetHours).toBe(8)
    })

    it('reconciles down to whatever the server actually persisted after a write', async () => {
      vi.mocked(settingsSyncService.getServerSettings).mockResolvedValue(null)
      // Even though the caller asks for a Pro-only value, the server clamps it
      // back to the default (e.g. the caller's real plan doesn't unlock it) —
      // the hook must end up reflecting that, not the optimistic local value.
      vi.mocked(settingsSyncService.putServerSettings).mockResolvedValue({
        ok: true,
        settings: {
          annualHolidayAllowance: 25,
          employmentStartDate: null,
          holidayAccrualMode: 'gradual',
          themeLightColor: null,
          themeDarkColor: null,
          dailyTargetHours: 8,
          holidayCarryoverEnabled: false,
        },
      })

      const { result } = renderHook(() => useAppSettings('token-123'))
      act(() => result.current.setDailyTargetHours(6))

      // Optimistic update applies immediately.
      expect(result.current.settings.dailyTargetHours).toBe(6)
      expect(settingsSyncService.putServerSettings).toHaveBeenCalledWith('token-123', expect.objectContaining({ dailyTargetHours: 6 }))

      await act(async () => {
        await Promise.resolve()
      })

      // Once the server responds, its clamped value is what sticks.
      expect(result.current.settings.dailyTargetHours).toBe(8)
      expect(JSON.parse(localStorage.getItem('appSettings')!).dailyTargetHours).toBe(8)
    })

    it('keeps the optimistic local value when the request fails (offline)', async () => {
      vi.mocked(settingsSyncService.getServerSettings).mockResolvedValue(null)
      vi.mocked(settingsSyncService.putServerSettings).mockResolvedValue({ ok: false, error: 'network' })

      const { result } = renderHook(() => useAppSettings('token-123'))
      await act(async () => {
        result.current.setDailyTargetHours(6)
        await Promise.resolve()
      })

      expect(result.current.settings.dailyTargetHours).toBe(6)
    })
  })
})
