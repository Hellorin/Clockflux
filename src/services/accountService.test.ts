import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteAccount } from './accountService'

describe('deleteAccount', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends an authenticated DELETE with the refresh cookie and reports success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    const result = await deleteAccount('access-token-123')

    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/account'),
      expect.objectContaining({
        method: 'DELETE',
        // credentials: 'include' is what lets the backend expire the
        // refresh cookie in the same response.
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token-123' }),
      })
    )
  })

  // Reporting success on a failed deletion would sign the user out and tell
  // them their account is gone while it is still very much there.
  it('reports failure on a non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))

    expect(await deleteAccount('access-token-123')).toBe(false)
  })

  it('reports failure when the request never completes', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    expect(await deleteAccount('access-token-123')).toBe(false)
  })
})
