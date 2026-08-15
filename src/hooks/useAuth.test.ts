import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from './useAuth'
import * as authService from '../services/authService'
import * as featuresService from '../services/featuresService'

vi.mock('../services/authService')
vi.mock('../services/featuresService')

const REFRESH_INTERVAL_MS = 10 * 60 * 1000
// Mirrors useAuth.ts. Duplicated rather than imported because the hook keeps
// them module-private.
const RETRY_BASE_MS = 15 * 1000

const user = { name: 'Ada Lovelace', email: 'ada@example.com', picture: 'https://example.com/ada.png', plan: 'pro' as const, cancelAtPeriodEnd: false }

describe('useAuth', () => {
  beforeEach(() => {
    vi.mocked(authService.loadUser).mockReturnValue(null)
    vi.mocked(authService.loadAccessToken).mockReturnValue(null)
    vi.mocked(featuresService.getFeaturesOrDefault).mockResolvedValue(featuresService.DEFAULT_FEATURES)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    window.history.pushState(null, '', '/')
  })

  it('does not attempt a refresh when signed out', async () => {
    renderHook(() => useAuth())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS)
    })
    expect(authService.refreshAccessToken).not.toHaveBeenCalled()
  })

  it('refreshes immediately on mount when already signed in, and adopts the new token', async () => {
    vi.mocked(authService.loadUser).mockReturnValue(user)
    vi.mocked(authService.loadAccessToken).mockReturnValueOnce('stale-token').mockReturnValue('fresh-token')
    vi.mocked(authService.refreshSession).mockResolvedValue({ ok: true, user })

    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await Promise.resolve()
    })

    expect(authService.refreshSession).toHaveBeenCalledTimes(1)
    expect(result.current.accessToken).toBe('fresh-token')
    expect(result.current.user).toEqual(user)
  })

  it('refreshes again on the heartbeat while signed in', async () => {
    vi.mocked(authService.loadUser).mockReturnValue(user)
    vi.mocked(authService.loadAccessToken).mockReturnValue('token')
    vi.mocked(authService.refreshSession).mockResolvedValue({ ok: true, user })

    renderHook(() => useAuth())
    await act(async () => {
      await Promise.resolve()
    })
    expect(authService.refreshSession).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS)
    })
    expect(authService.refreshSession).toHaveBeenCalledTimes(2)
  })

  it('signs out locally when the refresh token is no longer valid', async () => {
    vi.mocked(authService.loadUser).mockReturnValue(user)
    vi.mocked(authService.loadAccessToken).mockReturnValue('token')
    vi.mocked(authService.refreshSession).mockResolvedValue({ ok: false, error: 'auth' })

    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await Promise.resolve()
    })

    // A dead refresh token isn't evidence the cloud copy is current, so this
    // automatic sign-out must never risk wiping local Pro data.
    expect(authService.signOut).toHaveBeenCalledWith(false)
    expect(result.current.user).toBeNull()
    expect(result.current.accessToken).toBeNull()
  })

  // The heartbeat used to sign the user out on *any* failed refresh, because
  // refreshAccessToken collapsed every reason to null. One dropped request on a
  // train therefore ended a perfectly valid session — and for a Pro user, took
  // their sync with it.
  it.each([['network'], ['timeout'], ['server']] as const)(
    'keeps the session alive when a refresh fails with %s',
    async error => {
      vi.mocked(authService.loadUser).mockReturnValue(user)
      vi.mocked(authService.loadAccessToken).mockReturnValue('token')
      vi.mocked(authService.refreshSession).mockResolvedValue({ ok: false, error })

      const { result } = renderHook(() => useAuth())
      await act(async () => {
        await Promise.resolve()
      })

      expect(authService.signOut).not.toHaveBeenCalled()
      expect(result.current.user).toEqual(user)
    }
  )

  it('retries after a transient failure, then recovers', async () => {
    vi.mocked(authService.loadUser).mockReturnValue(user)
    vi.mocked(authService.loadAccessToken).mockReturnValue('token')
    vi.mocked(authService.refreshSession)
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockResolvedValue({ ok: true, user })

    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await Promise.resolve()
    })
    expect(authService.refreshSession).toHaveBeenCalledTimes(1)

    // The retry runs well before the next heartbeat, so a brief outage costs
    // the user nothing.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_BASE_MS)
    })

    expect(authService.refreshSession).toHaveBeenCalledTimes(2)
    expect(authService.signOut).not.toHaveBeenCalled()
    expect(result.current.user).toEqual(user)
  })

  it('backs off rather than retrying at a fixed rate while an outage persists', async () => {
    vi.mocked(authService.loadUser).mockReturnValue(user)
    vi.mocked(authService.loadAccessToken).mockReturnValue('token')
    vi.mocked(authService.refreshSession).mockResolvedValue({ ok: false, error: 'network' })

    renderHook(() => useAuth())
    await act(async () => {
      await Promise.resolve()
    })
    expect(authService.refreshSession).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_BASE_MS)
    })
    expect(authService.refreshSession).toHaveBeenCalledTimes(2)

    // The second retry waits twice as long, so the first delay alone isn't
    // enough to trigger it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_BASE_MS - 1)
    })
    expect(authService.refreshSession).toHaveBeenCalledTimes(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_BASE_MS + 1)
    })
    expect(authService.refreshSession).toHaveBeenCalledTimes(3)
  })

  it('stops the heartbeat once signed out', async () => {
    vi.mocked(authService.loadUser).mockReturnValue(user)
    vi.mocked(authService.loadAccessToken).mockReturnValue('token')
    vi.mocked(authService.refreshSession).mockResolvedValue({ ok: true, user })

    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await Promise.resolve()
    })

    act(() => result.current.signOut())
    vi.mocked(authService.refreshAccessToken).mockClear()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS * 2)
    })
    expect(authService.refreshAccessToken).not.toHaveBeenCalled()
  })

  describe('returning from redirect-mode Google sign-in', () => {
    it('exchanges the refresh cookie for a session on ?auth=success, and strips the marker from the URL', async () => {
      window.history.pushState(null, '', '/?auth=success&foo=bar')
      // The redirect-return path uses refreshAccessToken, not refreshSession —
      // it has no session to preserve on failure, so it has no use for the
      // reason.
      vi.mocked(authService.refreshAccessToken).mockResolvedValue(user)
      vi.mocked(authService.refreshSession).mockResolvedValue({ ok: true, user })
      vi.mocked(authService.loadAccessToken).mockReturnValue('fresh-token')

      const { result } = renderHook(() => useAuth())
      await act(async () => {
        await Promise.resolve()
      })

      expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1)
      expect(result.current.user).toEqual(user)
      expect(result.current.accessToken).toBe('fresh-token')
      expect(window.location.search).toBe('?foo=bar')
    })

    it('does not attempt a refresh on ?auth=error, but still strips the marker from the URL', async () => {
      window.history.pushState(null, '', '/?auth=error')

      renderHook(() => useAuth())
      await act(async () => {
        await Promise.resolve()
      })

      expect(authService.refreshAccessToken).not.toHaveBeenCalled()
      expect(window.location.search).toBe('')
    })
  })
})
