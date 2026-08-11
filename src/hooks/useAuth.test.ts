import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from './useAuth'
import * as authService from '../services/authService'
import * as featuresService from '../services/featuresService'

vi.mock('../services/authService')
vi.mock('../services/featuresService')

const REFRESH_INTERVAL_MS = 10 * 60 * 1000

const user = { name: 'Ada Lovelace', email: 'ada@example.com', picture: 'https://example.com/ada.png', plan: 'pro' as const }

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
    vi.mocked(authService.refreshAccessToken).mockResolvedValue(user)

    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await Promise.resolve()
    })

    expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(result.current.accessToken).toBe('fresh-token')
    expect(result.current.user).toEqual(user)
  })

  it('refreshes again on the heartbeat while signed in', async () => {
    vi.mocked(authService.loadUser).mockReturnValue(user)
    vi.mocked(authService.loadAccessToken).mockReturnValue('token')
    vi.mocked(authService.refreshAccessToken).mockResolvedValue(user)

    renderHook(() => useAuth())
    await act(async () => {
      await Promise.resolve()
    })
    expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS)
    })
    expect(authService.refreshAccessToken).toHaveBeenCalledTimes(2)
  })

  it('signs out locally when the refresh token is no longer valid', async () => {
    vi.mocked(authService.loadUser).mockReturnValue(user)
    vi.mocked(authService.loadAccessToken).mockReturnValue('token')
    vi.mocked(authService.refreshAccessToken).mockResolvedValue(null)

    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await Promise.resolve()
    })

    expect(authService.signOut).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
    expect(result.current.accessToken).toBeNull()
  })

  it('stops the heartbeat once signed out', async () => {
    vi.mocked(authService.loadUser).mockReturnValue(user)
    vi.mocked(authService.loadAccessToken).mockReturnValue('token')
    vi.mocked(authService.refreshAccessToken).mockResolvedValue(user)

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
      vi.mocked(authService.refreshAccessToken).mockResolvedValue(user)
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
