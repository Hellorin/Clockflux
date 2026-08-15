import { apiFetch, type ApiError } from './apiClient'
import { refreshAccessToken, loadAccessToken } from './authService'
import type { Settings } from '../types'

/**
 * Obtains a fresh access token after a 401, reusing authService's single-flight
 * refresh. Shared by both calls below.
 *
 * Refresh tokens are single-use and a second concurrent redemption is treated
 * server-side as theft, so it matters that this goes through the shared
 * in-flight promise rather than starting its own request.
 */
async function refreshForRetry(): Promise<string | null> {
  const user = await refreshAccessToken()
  return user ? loadAccessToken() : null
}

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
  const result = await apiFetch(
    { path: '/api/v1/settings', accessToken, refreshToken: refreshForRetry },
    isSettingsResponse
  )
  return result.ok ? normalize(result.value.settings) : null
}

/** Outcome of a settings save, so the UI can say whether it actually landed. */
export type PutSettingsResult =
  | { ok: true; settings: Settings }
  | { ok: false; error: ApiError }

/**
 * Pushes settings to /api/v1/settings. Available to any authenticated caller
 * regardless of plan; the backend clamps Pro-only fields to their default
 * when the caller's plan doesn't unlock them rather than rejecting the
 * request outright. Returns exactly what the server actually persisted (the
 * clamped result), so the caller can adopt it as the new local truth instead
 * of trusting what it sent.
 *
 * Reports the failure rather than swallowing it. This used to return null and
 * the only caller simply returned on that, so a setting the user had just
 * changed appeared saved locally while the server never received it — with
 * zero indication anywhere. Of everything in the app that could fail quietly,
 * this was the quietest.
 */
export async function putServerSettings(accessToken: string, settings: Settings): Promise<PutSettingsResult> {
  const result = await apiFetch(
    {
      path: '/api/v1/settings',
      method: 'PUT',
      body: settings,
      accessToken,
      refreshToken: refreshForRetry,
    },
    isSettingsResponse
  )
  return result.ok
    ? { ok: true, settings: normalize(result.value.settings) }
    : { ok: false, error: result.error }
}
