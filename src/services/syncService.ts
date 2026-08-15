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
 * Fetches the caller's synced data from /api/v1/sync (Pro plan only).
 * Returns null on any failure (offline, backend down, not Pro, etc.) so
 * callers can fall back to "never synced" rather than throwing.
 */
export async function getSync(accessToken: string): Promise<SyncGetResponse | null> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/sync`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    })
    if (!response.ok) return null
    const data = await response.json()
    if (!isSyncGetResponse(data)) return null
    return data
  } catch {
    return null
  }
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
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
      body: JSON.stringify({ ...data, expectedLastSyncedAt }),
    })

    if (response.status === 409) {
      const body = await response.json()
      // A 409 whose body we can't read is still a conflict — reporting it as a
      // generic failure would have the caller retry the same losing push.
      return isSyncGetResponse(body) ? { status: 'conflict', server: body } : { status: 'failed' }
    }
    if (!response.ok) return { status: 'failed' }

    const body = await response.json()
    if (!isSyncPutResponse(body)) return { status: 'failed' }
    return { status: 'ok', lastSyncedAt: body.lastSyncedAt }
  } catch {
    return { status: 'failed' }
  }
}
