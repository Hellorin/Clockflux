import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSync, pushSync } from './syncService'

const emptyData = { days: {}, daysOff: {}, settings: { annualHolidayAllowance: 25, employmentStartDate: null, holidayAccrualMode: 'gradual' as const, themeLightColor: null, themeDarkColor: null, dailyTargetHours: 8, holidayCarryoverEnabled: false } }

describe('getSync', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed response on a successful call', async () => {
    const body = { data: emptyData, lastSyncedAt: '2026-08-11T10:00:00Z' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))

    const result = await getSync('access-token-123')

    expect(result).toEqual(body)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/sync'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer access-token-123' },
        credentials: 'include',
      })
    )
  })

  it('returns null on a non-OK response (e.g. free plan is forbidden)', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }))

    const result = await getSync('access-token-123')

    expect(result).toBeNull()
  })

  it('returns null when the response body is malformed', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ foo: 'bar' }), { status: 200 }))

    const result = await getSync('access-token-123')

    expect(result).toBeNull()
  })

  it('returns null when the network request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    const result = await getSync('access-token-123')

    expect(result).toBeNull()
  })
})

describe('pushSync', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PUTs the data with its precondition and reports success', async () => {
    const body = { lastSyncedAt: '2026-08-11T10:00:00Z' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))

    const result = await pushSync('access-token-123', emptyData, '2026-08-10T10:00:00Z')

    expect(result).toEqual({ status: 'ok', lastSyncedAt: '2026-08-11T10:00:00Z' })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/sync'),
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer access-token-123' },
        // The precondition is what makes this a compare-and-swap rather than a
        // blind overwrite, so it has to actually reach the wire.
        body: JSON.stringify({ ...emptyData, expectedLastSyncedAt: '2026-08-10T10:00:00Z' }),
      })
    )
  })

  it('sends a null precondition when this device has never synced', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ lastSyncedAt: '2026-08-11T10:00:00Z' }), { status: 200 })
    )

    await pushSync('access-token-123', emptyData, null)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/sync'),
      expect.objectContaining({
        body: JSON.stringify({ ...emptyData, expectedLastSyncedAt: null }),
      })
    )
  })

  it('reports a 409 as a conflict, carrying the server state', async () => {
    // The server answers 409 with its current copy so the caller can reconcile
    // without a second round trip.
    const server = { data: emptyData, lastSyncedAt: '2026-08-12T10:00:00Z' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(server), { status: 409 }))

    const result = await pushSync('access-token-123', emptyData, '2026-08-10T10:00:00Z')

    expect(result).toEqual({ status: 'conflict', server })
  })

  it('reports a failure on a non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))

    const result = await pushSync('access-token-123', emptyData, null)

    expect(result).toEqual({ status: 'failed' })
  })

  it('reports a failure when the network request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    const result = await pushSync('access-token-123', emptyData, null)

    expect(result).toEqual({ status: 'failed' })
  })

  it('treats an unreadable 409 body as a failure rather than a bad conflict', async () => {
    // Reporting it as a conflict with no server state would have the caller
    // "reconcile" against nothing; reporting a plain failure at least retries.
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ nonsense: true }), { status: 409 }))

    const result = await pushSync('access-token-123', emptyData, null)

    expect(result).toEqual({ status: 'failed' })
  })
})
