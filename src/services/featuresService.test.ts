import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatures } from './featuresService'

describe('getFeatures', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed features on a successful response', async () => {
    const body = { authenticated: true, features: ['beta-calendar', 'new-dashboard'] }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))

    const result = await getFeatures('access-token-123')

    expect(result).toEqual(body)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/features'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer access-token-123' },
        credentials: 'include',
      })
    )
  })

  it('returns null on a non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }))

    const result = await getFeatures('access-token-123')

    expect(result).toBeNull()
  })

  it('returns null when the response body is malformed', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ foo: 'bar' }), { status: 200 }))

    const result = await getFeatures('access-token-123')

    expect(result).toBeNull()
  })

  it('returns null when the network request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    const result = await getFeatures('access-token-123')

    expect(result).toBeNull()
  })
})
