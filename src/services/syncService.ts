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
 * Pushes the caller's current data to /api/v1/sync (Pro plan only), making it
 * the new server-side snapshot. Returns null on any failure.
 */
export async function pushSync(accessToken: string, data: SyncData): Promise<SyncPutResponse | null> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!response.ok) return null
    const body = await response.json()
    if (!isSyncPutResponse(body)) return null
    return body
  } catch {
    return null
  }
}
