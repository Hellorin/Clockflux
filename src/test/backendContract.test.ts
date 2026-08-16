import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getSync } from '../services/syncService'
import { getServerSettings } from '../services/settingsSyncService'
import { getFeaturesOrDefault, DEFAULT_FEATURES } from '../services/featuresService'
import { refreshSession } from '../services/authService'

/**
 * Every response this app validates, checked against what the backend actually
 * sends rather than a hand-written approximation of it.
 *
 * This file exists because two bugs of exactly one shape reached production
 * testing. Both were 200 responses the client discarded as malformed:
 *
 *   - a nil Go map marshals to JSON `null`, not `{}`, so a user with nothing
 *     stored got `"days": null` and their first sync after upgrading to Pro
 *     was thrown away
 *   - `picture,omitempty` dropped the field entirely for a Google account with
 *     no profile photo, so isAuthUser rejected them and they could not sign in
 *     at all
 *
 * Neither was visible from either side alone. The service tests all used
 * fixtures written by hand from the TypeScript interface, which is a
 * description of what we *expect*, not of what Go emits — so they agreed with
 * the code and disagreed with the server.
 *
 * The payloads below are copied verbatim from `json.Marshal` of the real
 * handler response structs. Their Go-side counterpart is
 * internal/handler/wire_contract_test.go, which fails if a field the client
 * validates ever stops being sent.
 */

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

function respond(body: unknown, status = 200) {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status }))
}

describe('POST /auth/refresh', () => {
  it('accepts a user with no profile photo', async () => {
    // The exact case that blocked sign-in: Google does not guarantee a picture
    // claim, and the field used to vanish rather than come back empty.
    respond({
      user: { googleId: 'g1', email: 'ada@example.com', name: 'Ada', picture: '', plan: 'free', cancelAtPeriodEnd: false },
      accessToken: 'jwt',
    })

    const result = await refreshSession()

    expect(result.ok).toBe(true)
  })

  it('accepts a user whose picture field is absent entirely', async () => {
    // What an older backend build sent, and what a user cached before this
    // change still has in localStorage.
    respond({
      user: { googleId: 'g1', email: 'ada@example.com', name: 'Ada', plan: 'free', cancelAtPeriodEnd: false },
      accessToken: 'jwt',
    })

    const result = await refreshSession()

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.user.picture).toBe('')
  })

  it('accepts a Pro user with the full field set', async () => {
    respond({
      user: { googleId: 'g1', email: 'ada@example.com', name: 'Ada', picture: 'https://x/p.png', plan: 'pro', cancelAtPeriodEnd: false },
      accessToken: 'jwt',
    })

    const result = await refreshSession()

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.user.plan).toBe('pro')
  })

  it('still rejects a response that is genuinely wrong', async () => {
    // Tolerance must not become "accept anything" — the whole point of
    // validating is catching a backend that changed under us.
    respond({ user: { email: 'ada@example.com', plan: 'free' }, accessToken: 'jwt' })

    expect((await refreshSession()).ok).toBe(false)
  })
})

describe('GET /sync', () => {
  it('accepts a user who has never synced', async () => {
    respond({
      data: {
        days: {},
        daysOff: {},
        settings: { annualHolidayAllowance: 0, employmentStartDate: null, holidayAccrualMode: '', holidayCarryoverEnabled: false },
      },
      lastSyncedAt: null,
    })

    expect(await getSync('token')).not.toBeNull()
  })

  it('accepts the older null-map shape', async () => {
    respond({
      data: {
        days: null,
        daysOff: null,
        settings: { annualHolidayAllowance: 0, employmentStartDate: null, holidayAccrualMode: '', holidayCarryoverEnabled: false },
      },
      lastSyncedAt: null,
    })

    const result = await getSync('token')
    expect(result?.data.days).toEqual({})
  })
})

describe('GET /settings', () => {
  it('accepts the zero-value settings of a caller who never saved any', async () => {
    // themeLightColor, themeDarkColor and dailyTargetHours are all omitempty
    // and genuinely absent here — the client fills them in.
    respond({
      settings: { annualHolidayAllowance: 0, employmentStartDate: null, holidayAccrualMode: '', holidayCarryoverEnabled: false },
    })

    const settings = await getServerSettings('token')

    expect(settings).not.toBeNull()
    expect(settings!.dailyTargetHours).toBe(8)
    expect(settings!.themeLightColor).toBeNull()
  })

  it('accepts a fully-populated settings document', async () => {
    respond({
      settings: {
        annualHolidayAllowance: 25,
        employmentStartDate: null,
        holidayAccrualMode: 'gradual',
        dailyTargetHours: 8,
        holidayCarryoverEnabled: false,
      },
    })

    expect(await getServerSettings('token')).not.toBeNull()
  })
})

describe('GET /features', () => {
  it('accepts an empty feature set', async () => {
    respond({ authenticated: false, features: [] })

    expect(await getFeaturesOrDefault()).toEqual([])
  })

  it('tolerates a null feature list rather than falling back for everyone', async () => {
    // A nil Go slice would marshal this way. The backend builds a non-nil
    // slice and a Go test pins that, but treating null as fatal here would
    // silently drop every user to DEFAULT_FEATURES.
    respond({ authenticated: true, features: null })

    expect(await getFeaturesOrDefault('token')).toEqual([])
  })

  it('falls back to defaults when the response is genuinely unusable', async () => {
    respond({ authenticated: 'yes', features: [] })

    expect(await getFeaturesOrDefault()).toEqual(DEFAULT_FEATURES)
  })
})
