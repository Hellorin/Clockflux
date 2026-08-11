import type { Settings } from '../types'

interface SettingsResponse {
  settings: Settings
}

function isSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Settings>
  return (
    typeof candidate.annualHolidayAllowance === 'number' &&
    (candidate.employmentStartDate === null || typeof candidate.employmentStartDate === 'string' || candidate.employmentStartDate === undefined) &&
    typeof candidate.holidayAccrualMode === 'string'
  )
}

function isSettingsResponse(value: unknown): value is SettingsResponse {
  if (!value || typeof value !== 'object') return false
  return isSettings((value as Partial<SettingsResponse>).settings)
}

// Backend responses may omit optional fields entirely (omitempty), so this
// fills them back in to match the TS Settings shape the rest of the app
// expects, rather than leaving them `undefined`.
function normalize(settings: Settings): Settings {
  return {
    ...settings,
    employmentStartDate: settings.employmentStartDate ?? null,
    themeLightColor: settings.themeLightColor ?? null,
    themeDarkColor: settings.themeDarkColor ?? null,
    dailyTargetHours: settings.dailyTargetHours || 8,
    holidayCarryoverEnabled: !!settings.holidayCarryoverEnabled,
  }
}

/**
 * Fetches the caller's server-saved settings from /api/v1/settings. Available
 * to any authenticated caller regardless of plan — this is the authoritative
 * source for Pro-gated fields (theme colors, custom daily target, holiday
 * carryover): the backend strips anything the caller's plan doesn't actually
 * unlock, so what it returns here is what should be trusted, not whatever a
 * stale local cache says. Returns null on any failure (offline, backend
 * down, never saved before, etc.) so callers can fall back to local state.
 */
export async function getServerSettings(accessToken: string): Promise<Settings | null> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    })
    if (!response.ok) return null
    const data = await response.json()
    if (!isSettingsResponse(data)) return null
    return normalize(data.settings)
  } catch {
    return null
  }
}

/**
 * Pushes settings to /api/v1/settings. Available to any authenticated caller
 * regardless of plan; the backend clamps Pro-only fields to their default
 * when the caller's plan doesn't unlock them rather than rejecting the
 * request outright. Returns exactly what the server actually persisted (the
 * clamped result), so the caller can adopt it as the new local truth instead
 * of trusting what it sent. Returns null on any failure.
 */
export async function putServerSettings(accessToken: string, settings: Settings): Promise<Settings | null> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
      body: JSON.stringify(settings),
    })
    if (!response.ok) return null
    const data = await response.json()
    if (!isSettingsResponse(data)) return null
    return normalize(data.settings)
  } catch {
    return null
  }
}
