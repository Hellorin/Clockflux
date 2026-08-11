import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signInWithGoogle } from './authService'

const STORAGE_KEY = 'timeforgeUser'
const ACCESS_TOKEN_STORAGE_KEY = 'timeforgeAccessToken'

describe('signInWithGoogle', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns and persists the user and access token from a successful response', async () => {
    const user = { name: 'Ada Lovelace', email: 'ada@example.com', picture: 'https://example.com/ada.png', plan: 'pro' }
    const accessToken = 'access-token-123'
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ user, accessToken }), { status: 200 }))

    const result = await signInWithGoogle('credential-token')

    expect(result).toEqual(user)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(user)
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toEqual(accessToken)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/google'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ credential: 'credential-token' }),
      })
    )
  })

  it('returns null and does not persist anything on a non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }))

    const result = await signInWithGoogle('credential-token')

    expect(result).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('returns null and does not persist anything when the user object is malformed', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ user: { sub: '123' }, accessToken: 'access-token-123' }), { status: 200 })
    )

    const result = await signInWithGoogle('credential-token')

    expect(result).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('returns null when the network request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    const result = await signInWithGoogle('credential-token')

    expect(result).toBeNull()
  })
})
