import { useCallback, useState } from 'react'
import * as settingsService from '../services/settingsService'
import { isValidDarkThemeColor, isValidLightThemeColor } from '../constants/themeColors'
import type { HolidayAccrualMode, Settings } from '../types'

const DEFAULTS: Settings = {
  annualHolidayAllowance: 25,
  employmentStartDate: null,
  holidayAccrualMode: 'gradual',
  themeLightColor: null,
  themeDarkColor: null,
  dailyTargetHours: 8,
}

function loadSettings(): Settings {
  const parsed = settingsService.loadSettingsRaw() ?? {}
  const merged = { ...DEFAULTS, ...parsed }
  // Guard against a stale value from a previous release's swatch list (or
  // corrupted storage) no longer being one of the curated options.
  if (!isValidLightThemeColor(merged.themeLightColor)) merged.themeLightColor = null
  if (!isValidDarkThemeColor(merged.themeDarkColor)) merged.themeDarkColor = null
  return merged
}

export function useAppSettings() {
  const [settings, setSettings] = useState(loadSettings)

  const setAnnualHolidayAllowance = useCallback((value: number | string) => {
    const n = Math.max(0, Math.floor(Number(value) || 0))
    setSettings(prev => {
      const next = { ...prev, annualHolidayAllowance: n }
      settingsService.saveSettings(next)
      return next
    })
  }, [])

  const setEmploymentStartDate = useCallback((value: string | null) => {
    const v = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
    setSettings(prev => {
      const next = { ...prev, employmentStartDate: v }
      settingsService.saveSettings(next)
      return next
    })
  }, [])

  const setHolidayAccrualMode = useCallback((value: HolidayAccrualMode | string) => {
    const v: HolidayAccrualMode = value === 'immediate' ? 'immediate' : 'gradual'
    setSettings(prev => {
      const next = { ...prev, holidayAccrualMode: v }
      settingsService.saveSettings(next)
      return next
    })
  }, [])

  const setDailyTargetHours = useCallback((value: number | string) => {
    const n = Math.max(0, Number(value) || 0)
    setSettings(prev => {
      const next = { ...prev, dailyTargetHours: n }
      settingsService.saveSettings(next)
      return next
    })
  }, [])

  const setThemeLightColor = useCallback((value: string | null) => {
    const v = isValidLightThemeColor(value) ? value : null
    setSettings(prev => {
      const next = { ...prev, themeLightColor: v }
      settingsService.saveSettings(next)
      return next
    })
  }, [])

  const setThemeDarkColor = useCallback((value: string | null) => {
    const v = isValidDarkThemeColor(value) ? value : null
    setSettings(prev => {
      const next = { ...prev, themeDarkColor: v }
      settingsService.saveSettings(next)
      return next
    })
  }, [])

  // Wholesale overwrite, used to restore a synced snapshot pulled from the
  // backend. Not exposed anywhere in the UI, only to the sync hook.
  const replaceSettings = useCallback((next: Settings) => {
    const merged = { ...DEFAULTS, ...next }
    if (!isValidLightThemeColor(merged.themeLightColor)) merged.themeLightColor = null
    if (!isValidDarkThemeColor(merged.themeDarkColor)) merged.themeDarkColor = null
    settingsService.saveSettings(merged)
    setSettings(merged)
  }, [])

  return { settings, setAnnualHolidayAllowance, setEmploymentStartDate, setHolidayAccrualMode, setDailyTargetHours, setThemeLightColor, setThemeDarkColor, replaceSettings }
}
