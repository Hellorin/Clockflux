import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signInWithGoogle, refreshAccessToken, signOut, saveUser } from './authService'

const STORAGE_KEY = 'appUser'
const ACCESS_TOKEN_STORAGE_KEY = 'appAccessToken'
const TIME_ENTRIES_STORAGE_KEY = 'app'
const SETTINGS_STORAGE_KEY = 'appSettings'

describe('signInWithGoogle', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns and persists the user and access token from a successful response', async () => {
    const user = { name: 'Ada Lovelace', email: 'ada@example.com', picture: 'https://example.com/ada.png', plan: 'pro', cancelAtPeriodEnd: false }
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

describe('refreshAccessToken', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns and persists the user and access token from a successful response, sending the refresh cookie', async () => {
    const user = { name: 'Ada Lovelace', email: 'ada@example.com', picture: 'https://example.com/ada.png', plan: 'pro', cancelAtPeriodEnd: false }
    const accessToken = 'new-access-token'
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ user, accessToken }), { status: 200 }))

    const result = await refreshAccessToken()

    expect(result).toEqual(user)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(user)
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toEqual(accessToken)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/refresh'),
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    )
  })

  it('returns null and does not persist anything on a non-OK response (e.g. no/expired refresh token)', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }))

    const result = await refreshAccessToken()

    expect(result).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('returns null when the network request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    const result = await refreshAccessToken()

    expect(result).toBeNull()
  })
})

describe('signOut', () => {
  const user = { name: 'Ada Lovelace', email: 'ada@example.com', picture: 'https://example.com/ada.png', plan: 'pro' as const, cancelAtPeriodEnd: false }

  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls the backend logout endpoint with the refresh cookie', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await signOut()

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/logout'),
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    )
  })

  it('clears the cached user, access token, time entries and settings for a pro user', async () => {
    saveUser(user)
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'a-token')
    localStorage.setItem(TIME_ENTRIES_STORAGE_KEY, JSON.stringify({ entries: [] }))
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ annualHolidayAllowance: 30 }))
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await signOut()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(TIME_ENTRIES_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull()
  })

  it('clears the cached user and access token but keeps time entries and settings for a free user', async () => {
    const freeUser = { ...user, plan: 'free' as const }
    saveUser(freeUser)
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'a-token')
    localStorage.setItem(TIME_ENTRIES_STORAGE_KEY, JSON.stringify({ entries: [] }))
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ annualHolidayAllowance: 30 }))
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await signOut()

    // Free plan has no cloud backup — localStorage is the only copy of this
    // data, so signing out must not delete it.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(TIME_ENTRIES_STORAGE_KEY)).not.toBeNull()
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).not.toBeNull()
  })

  it('still clears local state when the network request fails', async () => {
    saveUser(user)
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'a-token')
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    await signOut()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull()
  })
})
