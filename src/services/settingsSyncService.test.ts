import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getServerSettings, putServerSettings } from './settingsSyncService'

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

  it('returns null when the network request fails', async () => {
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

    expect(result).toEqual(persisted)
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

  it('returns null on a non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))

    const result = await putServerSettings('access-token-123', settings)

    expect(result).toBeNull()
  })

  it('returns null when the network request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    const result = await putServerSettings('access-token-123', settings)

    expect(result).toBeNull()
  })
})
