import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelSubscription } from './billingService'

describe('cancelSubscription', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts to the cancel-subscription endpoint with the bearer token and returns true on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))

    const result = await cancelSubscription('access-token-123')

    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/billing/cancel-subscription'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token-123' }),
      })
    )
  })

  it('returns false on a non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))

    const result = await cancelSubscription('access-token-123')

    expect(result).toBe(false)
  })

  it('returns false when the network request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    const result = await cancelSubscription('access-token-123')

    expect(result).toBe(false)
  })
})
