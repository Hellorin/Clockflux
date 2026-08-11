import { useCallback, useEffect, useRef, useState } from 'react'
import * as authService from '../services/authService'
import { getSync, pushSync } from '../services/syncService'
import type { DaysMap, DaysOffMap, Settings, SyncData } from '../types'

const AUTO_SYNC_INTERVAL_MS = 60 * 60 * 1000 // every hour
const ENTRY_CHANGE_DEBOUNCE_MS = 800 // check in/out or a day-off edit: sync almost immediately
const SETTINGS_CHANGE_DEBOUNCE_MS = 5000 // settings fields can be typed into, so wait for a pause

interface UseSyncArgs {
  enabled: boolean
  days: DaysMap
  daysOff: DaysOffMap
  settings: Settings
}

/**
 * Pushes local time-tracking + settings data to the backend for Pro users:
 * automatically an hour after the last sync, shortly after a local change,
 * and on demand via syncNow(). Local data is always the source of truth —
 * this never pulls data back down to overwrite it, it only reads the
 * server's lastSyncedAt once (on enable) so the UI has something to show
 * before the first push completes.
 */
export function useSync({ enabled, days, daysOff, settings }: UseSyncArgs) {
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const isSyncingRef = useRef(false)
  const syncedSnapshotRef = useRef<string | null>(null)
  const syncedEntriesSnapshotRef = useRef<string | null>(null)
  const latestDataRef = useRef<SyncData>({ days, daysOff, settings })
  latestDataRef.current = { days, daysOff, settings }

  const snapshot = JSON.stringify(latestDataRef.current)
  const entriesSnapshot = JSON.stringify({ days, daysOff })
  const isDirty = syncedSnapshotRef.current !== snapshot

  const syncNow = useCallback(async (force = false) => {
    if (isSyncingRef.current) return
    const accessToken = authService.loadAccessToken()
    if (!accessToken) return

    const payload = latestDataRef.current
    const payloadSnapshot = JSON.stringify(payload)
    if (!force && payloadSnapshot === syncedSnapshotRef.current) return

    isSyncingRef.current = true
    setIsSyncing(true)
    try {
      const result = await pushSync(accessToken, payload)
      if (result) {
        syncedSnapshotRef.current = payloadSnapshot
        syncedEntriesSnapshotRef.current = JSON.stringify({ days: payload.days, daysOff: payload.daysOff })
        setLastSyncedAt(new Date(result.lastSyncedAt))
      }
    } finally {
      isSyncingRef.current = false
      setIsSyncing(false)
    }
  }, [])

  // Seed lastSyncedAt once when sync becomes enabled, so the UI shows the
  // real last-synced time from a previous session rather than "never".
  useEffect(() => {
    if (!enabled) return
    const accessToken = authService.loadAccessToken()
    if (!accessToken) return
    let cancelled = false
    getSync(accessToken).then(result => {
      if (!cancelled && result?.lastSyncedAt) setLastSyncedAt(new Date(result.lastSyncedAt))
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  // Hourly heartbeat. Reads the latest data via the ref rather than a
  // dependency, so the interval isn't reset by every edit.
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => syncNow(), AUTO_SYNC_INTERVAL_MS)
    return () => clearInterval(id)
  }, [enabled, syncNow])

  // Check in/out and day-off edits sync almost immediately.
  useEffect(() => {
    if (!enabled || syncedEntriesSnapshotRef.current === entriesSnapshot) return
    const id = setTimeout(() => syncNow(), ENTRY_CHANGE_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [enabled, entriesSnapshot, syncNow])

  // Settings fields can be typed into, so give those a longer pause before
  // syncing. Also acts as a catch-all in case the fast path above ever
  // misses a change.
  useEffect(() => {
    if (!enabled || !isDirty) return
    const id = setTimeout(() => syncNow(), SETTINGS_CHANGE_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [enabled, isDirty, snapshot, syncNow])

  return { lastSyncedAt, isSyncing, isDirty, syncNow }
}
