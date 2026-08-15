import { apiFetch, apiFetchRaw } from './apiClient'
import { refreshAccessToken, loadAccessToken } from './authService'
import type { SyncData } from '../types'

export interface SyncGetResponse {
  data: SyncData
  lastSyncedAt: string | null
}

export interface SyncPutResponse {
  lastSyncedAt: string
}

function isSyncData(value: unknown): value is SyncData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SyncData>
  return (
    typeof candidate.days === 'object' &&
    candidate.days !== null &&
    typeof candidate.daysOff === 'object' &&
    candidate.daysOff !== null &&
    typeof candidate.settings === 'object' &&
    candidate.settings !== null
  )
}

function isSyncGetResponse(value: unknown): value is SyncGetResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SyncGetResponse>
  return isSyncData(candidate.data) && (candidate.lastSyncedAt === null || typeof candidate.lastSyncedAt === 'string')
}

function isSyncPutResponse(value: unknown): value is SyncPutResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SyncPutResponse>
  return typeof candidate.lastSyncedAt === 'string'
}

/**
 * Obtains a fresh access token after a 401, reusing authService's single-flight
 * refresh — refresh tokens are single-use and a second concurrent redemption is
 * treated server-side as theft, so this must not start its own request.
 */
async function refreshForRetry(): Promise<string | null> {
  const user = await refreshAccessToken()
  return user ? loadAccessToken() : null
}

/**
 * Fetches the caller's synced data from /api/v1/sync (Pro plan only).
 * Returns null on any failure (offline, backend down, not Pro, etc.) so
 * callers can fall back to "never synced" rather than throwing.
 */
export async function getSync(accessToken: string): Promise<SyncGetResponse | null> {
  const result = await apiFetch(
    { path: '/api/v1/sync', accessToken, refreshToken: refreshForRetry },
    isSyncGetResponse
  )
  return result.ok ? result.value : null
}

/**
 * What a push can come back as.
 *
 * 'conflict' is the case that did not previously exist: the server has moved on
 * since `expectedLastSyncedAt`, because another device wrote in the meantime.
 * It carries the current server state so the caller can reconcile immediately
 * rather than making a second request for it.
 */
export type PushSyncResult =
  | { status: 'ok'; lastSyncedAt: string }
  | { status: 'conflict'; server: SyncGetResponse }
  | { status: 'failed' }

/**
 * Pushes the caller's current data to /api/v1/sync (Pro plan only).
 *
 * `expectedLastSyncedAt` is the version this edit was based on. The server only
 * applies the write if its stored copy is still at that version, and answers
 * 409 otherwise. Pass null when this device has never synced.
 *
 * Without that precondition the push was an unconditional whole-document
 * overwrite. useSync's three-way reconcile only runs once per session, at page
 * load — so the hourly heartbeat, and every debounced push after it, went out
 * blind. A tab left open all day would replace everything a second device had
 * done since, silently, for a paid feature whose whole promise is that your
 * data survives across devices.
 */
export async function pushSync(
  accessToken: string,
  data: SyncData,
  expectedLastSyncedAt: string | null
): Promise<PushSyncResult> {
  const result = await apiFetchRaw({
    path: '/api/v1/sync',
    method: 'PUT',
    body: { ...data, expectedLastSyncedAt },
    accessToken,
    refreshToken: refreshForRetry,
    // 409 is not a failure here — it carries the server's current state, which
    // the caller needs in order to reconcile.
    okStatuses: [409],
  })
  if (!result.ok) return { status: 'failed' }

  let body: unknown
  try {
    body = await result.value.json()
  } catch {
    return { status: 'failed' }
  }

  if (result.status === 409) {
    // A conflict whose body we can't read is still a conflict, but without the
    // server state there is nothing to reconcile against — reporting a plain
    // failure at least retries rather than "reconciling" against nothing.
    return isSyncGetResponse(body) ? { status: 'conflict', server: body } : { status: 'failed' }
  }
  if (!isSyncPutResponse(body)) return { status: 'failed' }
  return { status: 'ok', lastSyncedAt: body.lastSyncedAt }
}
