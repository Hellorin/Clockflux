import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getServerSettings, putServerSettings } from './settingsSyncService'
import * as authService from './authService'

// settingsSyncService now routes through apiClient, which asks authService for
// a fresh token on a 401. Mocked so these tests exercise that retry without a
// real refresh round trip.
vi.mock('./authService')

const settings = { annualHolidayAllowance: 25, employmentStartDate: null, holidayAccrualMode: 'gradual' as const, themeLightColor: null, themeDarkColor: null, dailyTargetHours: 8, holidayCarryoverEnabled: false }

describe('getServerSettings', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed settings on a successful call', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ settings }), { status: 200 }))

    const result = await getServerSettings('access-token-123')

    expect(result).toEqual(settings)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/settings'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer access-token-123' },
        credentials: 'include',
      })
    )
  })

  it('fills in fields the backend omitted (omitempty) with defaults', async () => {
    // Free-plan response: Pro-only fields never even appear in the JSON.
    const sparse = { annualHolidayAllowance: 25, employmentStartDate: null, holidayAccrualMode: 'gradual' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ settings: sparse }), { status: 200 }))

    const result = await getServerSettings('access-token-123')

    expect(result).toEqual(settings)
  })

  it('returns null on a non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }))

    const result = await getServerSettings('access-token-123')

    expect(result).toBeNull()
  })

  it('returns null when the response body is malformed', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ foo: 'bar' }), { status: 200 }))

    const result = await getServerSettings('access-token-123')

    expect(result).toBeNull()
  })

  it('reports a network failure rather than swallowing it', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    const result = await getServerSettings('access-token-123')

    expect(result).toBeNull()
  })
})

describe('putServerSettings', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PUTs the settings and returns what the server actually persisted', async () => {
    // Caller asked for Pro fields; server (free plan) strips them — the
    // response, not the request, is what callers should trust.
    const requested = { ...settings, themeLightColor: '#fffbf5', dailyTargetHours: 6, holidayCarryoverEnabled: true }
    const persisted = settings
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ settings: persisted }), { status: 200 }))

    const result = await putServerSettings('access-token-123', requested)

    expect(result).toEqual({ ok: true, settings: persisted })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/settings'),
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer access-token-123' },
        body: JSON.stringify(requested),
      })
    )
  })

  it('reports a server failure rather than swallowing it', async () => {
    // This used to return null and the only caller returned on that, so the
    // user's change looked saved while the server never got it.
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))

    const result = await putServerSettings('access-token-123', settings)

    expect(result).toEqual({ ok: false, error: 'server' })
  })

  it('reports a network failure rather than swallowing it', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    const result = await putServerSettings('access-token-123', settings)

    expect(result).toEqual({ ok: false, error: 'network' })
  })

  it('retries once with a fresh token after a 401', async () => {
    // Access tokens last ~15 minutes; a laptop resumed from sleep lands a save
    // right after expiry. Every call site previously reported that as a plain
    // failure with nothing retrying.
    vi.mocked(authService.refreshAccessToken).mockResolvedValue({
      name: 'Ada', email: 'ada@example.com', picture: '', plan: 'pro', cancelAtPeriodEnd: false,
    })
    vi.mocked(authService.loadAccessToken).mockReturnValue('fresh-token')
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ settings }), { status: 200 }))

    const result = await putServerSettings('stale-token', settings)

    expect(result).toEqual({ ok: true, settings })
    expect(vi.mocked(fetch).mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer fresh-token' })
  })

  it('reports an auth failure when the refresh also fails', async () => {
    vi.mocked(authService.refreshAccessToken).mockResolvedValue(null)
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }))

    const result = await putServerSettings('stale-token', settings)

    expect(result).toEqual({ ok: false, error: 'auth' })
  })
})
