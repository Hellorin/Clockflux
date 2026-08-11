import { useCallback, useEffect, useRef, useState } from 'react'
import * as settingsService from '../services/settingsService'
import { getServerSettings, putServerSettings } from '../services/settingsSyncService'
import { isValidDarkThemeColor, isValidLightThemeColor } from '../constants/themeColors'
import type { HolidayAccrualMode, Settings } from '../types'

const DEFAULTS: Settings = {
  annualHolidayAllowance: 25,
  employmentStartDate: null,
  holidayAccrualMode: 'gradual',
  themeLightColor: null,
  themeDarkColor: null,
  dailyTargetHours: 8,
  holidayCarryoverEnabled: false,
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

/**
 * accessToken: when present, settings round-trip through the server-validated
 * /api/v1/settings endpoint instead of staying purely local. That endpoint is
 * what actually enforces the Pro-only fields (theme colors, custom daily
 * target, holiday carryover) against the caller's real plan — local state is
 * only ever a cache of whatever it last echoed back, never trusted on its own.
 * Pass undefined/null for anonymous/local-only use, which behaves exactly as
 * before (no network involved).
 */
export function useAppSettings(accessToken?: string | null) {
  const [settings, setSettings] = useState(loadSettings)
  const accessTokenRef = useRef(accessToken)
  useEffect(() => {
    accessTokenRef.current = accessToken
  }, [accessToken])

  // On sign-in (accessToken becomes available), pull the server's saved
  // settings and adopt them as truth. This is what closes the loophole on
  // reload/sign-in even if nothing was ever written this session: whatever
  // Pro-only fields the caller's real plan doesn't unlock come back stripped,
  // overriding any stale "Pro" values sitting in the local cache.
  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    getServerSettings(accessToken).then(serverSettings => {
      if (cancelled || !serverSettings) return
      setSettings(serverSettings)
      settingsService.saveSettings(serverSettings)
    })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  // Saves `next` locally (so anonymous/offline use is unaffected), then, when
  // signed in, pushes it to the server-validated endpoint and adopts whatever
  // it actually persisted. That response — not the locally computed value —
  // is what ends up trusted, since it's the only server-checked record of
  // these settings.
  const persist = useCallback((next: Settings) => {
    settingsService.saveSettings(next)
    const token = accessTokenRef.current
    if (!token) return
    putServerSettings(token, next).then(serverSettings => {
      if (!serverSettings) return
      setSettings(serverSettings)
      settingsService.saveSettings(serverSettings)
    })
  }, [])

  const setAnnualHolidayAllowance = useCallback((value: number | string) => {
    const n = Math.max(0, Math.floor(Number(value) || 0))
    setSettings(prev => {
      const next = { ...prev, annualHolidayAllowance: n }
      persist(next)
      return next
    })
  }, [persist])

  const setEmploymentStartDate = useCallback((value: string | null) => {
    const v = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
    setSettings(prev => {
      const next = { ...prev, employmentStartDate: v }
      persist(next)
      return next
    })
  }, [persist])

  const setHolidayAccrualMode = useCallback((value: HolidayAccrualMode | string) => {
    const v: HolidayAccrualMode = value === 'immediate' ? 'immediate' : 'gradual'
    setSettings(prev => {
      const next = { ...prev, holidayAccrualMode: v }
      persist(next)
      return next
    })
  }, [persist])

  const setDailyTargetHours = useCallback((value: number | string) => {
    const n = Math.max(0, Number(value) || 0)
    setSettings(prev => {
      const next = { ...prev, dailyTargetHours: n }
      persist(next)
      return next
    })
  }, [persist])

  const setHolidayCarryoverEnabled = useCallback((value: boolean) => {
    setSettings(prev => {
      const next = { ...prev, holidayCarryoverEnabled: !!value }
      persist(next)
      return next
    })
  }, [persist])

  const setThemeLightColor = useCallback((value: string | null) => {
    const v = isValidLightThemeColor(value) ? value : null
    setSettings(prev => {
      const next = { ...prev, themeLightColor: v }
      persist(next)
      return next
    })
  }, [persist])

  const setThemeDarkColor = useCallback((value: string | null) => {
    const v = isValidDarkThemeColor(value) ? value : null
    setSettings(prev => {
      const next = { ...prev, themeDarkColor: v }
      persist(next)
      return next
    })
  }, [persist])

  // Wholesale overwrite, used to restore a synced snapshot pulled from the
  // backend. Not exposed anywhere in the UI, only to the sync hook. Local
  // only — the data just came from the server (via /sync), so pushing it
  // straight back out to /api/v1/settings would be redundant.
  const replaceSettings = useCallback((next: Settings) => {
    const merged = { ...DEFAULTS, ...next }
    if (!isValidLightThemeColor(merged.themeLightColor)) merged.themeLightColor = null
    if (!isValidDarkThemeColor(merged.themeDarkColor)) merged.themeDarkColor = null
    settingsService.saveSettings(merged)
    setSettings(merged)
  }, [])

  return { settings, setAnnualHolidayAllowance, setEmploymentStartDate, setHolidayAccrualMode, setDailyTargetHours, setHolidayCarryoverEnabled, setThemeLightColor, setThemeDarkColor, replaceSettings }
}
