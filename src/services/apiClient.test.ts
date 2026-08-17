import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { apiFetch } from './apiClient'

const isRecord = (v: unknown): v is { hello: string } =>
  !!v && typeof v === 'object' && typeof (v as { hello?: unknown }).hello === 'string'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe('apiFetch', () => {
  it('returns the validated body on success', async () => {
    vi.mocked(fetch).mockResolvedValue(ok({ hello: 'world' }))

    const result = await apiFetch({ path: '/api/v1/thing' }, isRecord)

    expect(result).toEqual({ ok: true, status: 200, value: { hello: 'world' } })
  })

  it('gives every request a timeout signal', async () => {
    // A connection that opens and then stalls never settles on its own, so
    // without this the caller's await simply never returns.
    vi.mocked(fetch).mockResolvedValue(ok({ hello: 'world' }))

    await apiFetch({ path: '/api/v1/thing' }, isRecord)

    const init = vi.mocked(fetch).mock.calls[0][1]
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('tells a timeout apart from being offline', async () => {
    // One means the backend is wedged, the other that the request never left
    // the device — different things to tell the user.
    vi.mocked(fetch).mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    expect(await apiFetch({ path: '/x' }, isRecord)).toEqual({ ok: false, status: null, error: 'timeout' })

    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await apiFetch({ path: '/x' }, isRecord)).toEqual({ ok: false, status: null, error: 'network' })
  })

  it.each([
    [403, 'forbidden'],
    [418, 'client'],
    [500, 'server'],
    [503, 'server'],
  ])('classifies %i as %s', async (status, error) => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status }))

    const result = await apiFetch({ path: '/x' }, isRecord)

    expect(result).toEqual({ ok: false, status, error })
  })

  it('rejects a 2xx body of the wrong shape rather than passing it on', async () => {
    vi.mocked(fetch).mockResolvedValue(ok({ unexpected: true }))

    const result = await apiFetch({ path: '/x' }, isRecord)

    expect(result).toEqual({ ok: false, status: 200, error: 'malformed' })
  })

  it('sends the access token and a JSON body', async () => {
    vi.mocked(fetch).mockResolvedValue(ok({ hello: 'world' }))

    await apiFetch({ path: '/x', method: 'PUT', body: { a: 1 }, accessToken: 'tok' }, isRecord)

    const init = vi.mocked(fetch).mock.calls[0][1]
    expect(init).toMatchObject({
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify({ a: 1 }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
    })
  })

  describe('401 handling', () => {
    it('refreshes once and retries with the new token', async () => {
      // The gap this closes: a laptop resumed from sleep, or a throttled
      // background timer, lands a request after the ~15 minute token expiry.
      // Every call site previously reported that as a plain failure.
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(ok({ hello: 'world' }))
      const refreshToken = vi.fn().mockResolvedValue('fresh-token')

      const result = await apiFetch({ path: '/x', accessToken: 'stale', refreshToken }, isRecord)

      expect(result).toEqual({ ok: true, status: 200, value: { hello: 'world' } })
      expect(refreshToken).toHaveBeenCalledTimes(1)
      const retryInit = vi.mocked(fetch).mock.calls[1][1]
      expect(retryInit?.headers).toMatchObject({ Authorization: 'Bearer fresh-token' })
    })

    it('gives up as an auth failure when the refresh fails', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }))
      const refreshToken = vi.fn().mockResolvedValue(null)

      const result = await apiFetch({ path: '/x', accessToken: 'stale', refreshToken }, isRecord)

      expect(result).toEqual({ ok: false, status: 401, error: 'auth' })
    })

    it('retries at most once, so a persistent 401 cannot loop', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }))
      const refreshToken = vi.fn().mockResolvedValue('fresh-token')

      const result = await apiFetch({ path: '/x', accessToken: 'stale', refreshToken }, isRecord)

      expect(result).toEqual({ ok: false, status: 401, error: 'auth' })
      expect(refreshToken).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('does not retry anything other than a 401', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))
      const refreshToken = vi.fn()

      await apiFetch({ path: '/x', accessToken: 'tok', refreshToken }, isRecord)

      expect(refreshToken).not.toHaveBeenCalled()
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  it('succeeds with no body when no guard is supplied', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    const result = await apiFetch({ path: '/x', method: 'DELETE' })

    expect(result).toEqual({ ok: true, status: 204, value: undefined })
  })
})
