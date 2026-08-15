/**
 * The single place every backend call goes through.
 *
 * Before this, all ten fetch call sites were hand-rolled with the same three
 * gaps:
 *
 *   - No timeout. A connection that opens and then stalls (a captive portal, a
 *     dead load balancer, a phone that lost signal mid-request) never settles,
 *     so `await getSync(...)` simply never returns and the operation is wedged
 *     for the lifetime of the tab.
 *   - No 401 handling. Access tokens last ~15 minutes and useAuth refreshes on
 *     a 10-minute heartbeat, but a laptop resumed from sleep, a throttled
 *     background timer or a little clock skew all land a request after expiry.
 *     Every one of those came back 401 and was reported as a generic failure,
 *     with no call site retrying after a refresh.
 *   - `catch { return null }`. Offline, 500, 401-expired and 403-not-Pro all
 *     collapsed into one indistinguishable value, so the UI could not tell the
 *     user anything useful and no caller could decide whether retrying would
 *     help.
 *
 * Request cancellation comes along with the timeout: AbortSignal.timeout gives
 * every request a signal, so a caller can abandon one without leaving it
 * running.
 */

/** Why a request failed, at the granularity the UI actually acts on. */
export type ApiError =
  /** Offline, DNS failure, CORS/CSP block — the request never reached us. */
  | 'network'
  /** The request was still outstanding when its deadline elapsed. */
  | 'timeout'
  /** 401: the session is gone, and refreshing did not recover it. */
  | 'auth'
  /** 403: signed in, but not entitled — e.g. sync on the free plan. */
  | 'forbidden'
  /** 5xx: the backend is unwell. Retrying may help. */
  | 'server'
  /** 4xx we don't have a better name for. Retrying will not help. */
  | 'client'
  /** 2xx whose body wasn't the shape we require. */
  | 'malformed'

export type ApiResult<T> =
  | { ok: true; status: number; value: T }
  | { ok: false; status: number | null; error: ApiError }

/**
 * How long any single request may take before it is abandoned.
 *
 * Generous enough for a slow mobile connection carrying a full sync payload,
 * short enough that a wedged request surfaces as an error the user can act on
 * rather than a spinner that never stops.
 */
export const DEFAULT_TIMEOUT_MS = 15000

export interface ApiRequest {
  /** Path below the API origin, e.g. '/api/v1/sync'. */
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** Serialized as JSON when present. */
  body?: unknown
  /** Sent as a bearer token. Omit for the public endpoints. */
  accessToken?: string | null
  /**
   * Called once when a request comes back 401, to obtain a fresh access token
   * for a single retry. Passed in rather than imported so this module stays
   * free of any dependency on authService — which itself calls through here.
   *
   * authService.refreshAccessToken already shares one in-flight refresh across
   * concurrent callers, which matters a great deal: refresh tokens are
   * single-use and a second concurrent redemption is treated server-side as
   * theft, revoking the whole family. Several requests hitting 401 at once must
   * therefore not each start their own refresh.
   */
  refreshToken?: () => Promise<string | null>
  timeoutMs?: number
  /** Response headers to send. Content-Type is added automatically for a body. */
  headers?: Record<string, string>
  /**
   * Non-2xx statuses the caller wants handed back rather than turned into an
   * error, because the response body carries something it needs. The one case
   * today is PUT /sync answering 409 with the current server state so the
   * client can reconcile without a second round trip.
   */
  okStatuses?: number[]
}

function isSuccess(req: ApiRequest, response: Response): boolean {
  return response.ok || (req.okStatuses?.includes(response.status) ?? false)
}

function classify(status: number): ApiError {
  if (status === 401) return 'auth'
  if (status === 403) return 'forbidden'
  if (status >= 500) return 'server'
  return 'client'
}

async function send(req: ApiRequest, accessToken: string | null | undefined): Promise<Response> {
  const headers: Record<string, string> = { ...req.headers }
  if (req.body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  return fetch(`${import.meta.env.VITE_API_URL}${req.path}`, {
    method: req.method ?? 'GET',
    headers,
    credentials: 'include',
    signal: AbortSignal.timeout(req.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    ...(req.body !== undefined ? { body: JSON.stringify(req.body) } : {}),
  })
}

/**
 * Performs a request and hands back the raw Response on success, for the one
 * endpoint whose body isn't JSON: /api/v1/export streams a file.
 *
 * Shares the timeout and the single 401 retry with apiFetch; only the body
 * handling differs.
 */
export async function apiFetchRaw(req: ApiRequest): Promise<ApiResult<Response>> {
  let response: Response
  try {
    response = await send(req, req.accessToken)
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
    return { ok: false, status: null, error: timedOut ? 'timeout' : 'network' }
  }

  if (response.status === 401 && req.refreshToken) {
    const fresh = await req.refreshToken()
    if (!fresh) return { ok: false, status: 401, error: 'auth' }
    try {
      response = await send(req, fresh)
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
      return { ok: false, status: null, error: timedOut ? 'timeout' : 'network' }
    }
  }

  if (!isSuccess(req, response)) {
    return { ok: false, status: response.status, error: classify(response.status) }
  }
  return { ok: true, status: response.status, value: response }
}

/**
 * Performs a request and narrows the response body with `isValid`.
 *
 * Pass no guard for endpoints that return nothing meaningful; the result value
 * is then undefined.
 */
export async function apiFetch<T>(req: ApiRequest, isValid: (value: unknown) => value is T): Promise<ApiResult<T>>
export async function apiFetch(req: ApiRequest): Promise<ApiResult<undefined>>
export async function apiFetch<T>(
  req: ApiRequest,
  isValid?: (value: unknown) => value is T
): Promise<ApiResult<T | undefined>> {
  let response: Response
  try {
    response = await send(req, req.accessToken)
  } catch (err) {
    // AbortSignal.timeout aborts with a TimeoutError, which is worth telling
    // apart from being offline: one means the backend is slow or wedged, the
    // other that the request never left the device.
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
    return { ok: false, status: null, error: timedOut ? 'timeout' : 'network' }
  }

  // One retry, and only for 401. Anything else either won't be fixed by a new
  // token or is the caller's problem to handle.
  if (response.status === 401 && req.refreshToken) {
    const fresh = await req.refreshToken()
    if (!fresh) return { ok: false, status: 401, error: 'auth' }
    try {
      response = await send(req, fresh)
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
      return { ok: false, status: null, error: timedOut ? 'timeout' : 'network' }
    }
  }

  if (!isSuccess(req, response)) {
    return { ok: false, status: response.status, error: classify(response.status) }
  }

  if (!isValid) return { ok: true, status: response.status, value: undefined }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, status: response.status, error: 'malformed' }
  }
  // Every response is validated at runtime rather than cast — the existing
  // house rule here, kept.
  if (!isValid(body)) return { ok: false, status: response.status, error: 'malformed' }

  return { ok: true, status: response.status, value: body }
}
