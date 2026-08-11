import { useCallback, useEffect, useRef, useState } from 'react'
import * as authService from '../services/authService'
import { getSync, pushSync } from '../services/syncService'
import type { DaysMap, DaysOffMap, Settings, SyncData } from '../types'

function isTimeEntryDataEmpty(days: DaysMap, daysOff: DaysOffMap): boolean {
  return Object.keys(days).length === 0 && Object.keys(daysOff).length === 0
}

const AUTO_SYNC_INTERVAL_MS = 60 * 60 * 1000 // every hour
const ENTRY_CHANGE_DEBOUNCE_MS = 800 // check in/out or a day-off edit: sync almost immediately
const SETTINGS_CHANGE_DEBOUNCE_MS = 5000 // settings fields can be typed into, so wait for a pause

interface UseSyncArgs {
  enabled: boolean
  days: DaysMap
  daysOff: DaysOffMap
  settings: Settings
  // Called at most once, on enable, when local time-entry data is empty and
  // the server has a prior synced snapshot to restore. Never called when
  // local already has any days/daysOff, so it can't clobber unsynced work.
  onRestore: (data: SyncData) => void
}

/**
 * Pushes local time-tracking + settings data to the backend for Pro users:
 * automatically an hour after the last sync, shortly after a local change,
 * and on demand via syncNow(). Local data is normally the source of truth —
 * pushes always overwrite the server snapshot, this never merges. The one
 * exception is a fresh/cleared browser: if local time-entry data is empty
 * when sync turns on, it pulls the server's snapshot down once via
 * onRestore() before any push can happen, so signing in on a wiped browser
 * restores your data instead of erasing the cloud copy with an empty push.
 */
export function useSync({ enabled, days, daysOff, settings, onRestore }: UseSyncArgs) {
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
  // Also the one place a pull happens: if local time-entry data is empty
  // (fresh/cleared browser) and the server has a snapshot, restore it before
  // the push effects below get a chance to fire and overwrite it.
  useEffect(() => {
    if (!enabled) return
    const accessToken = authService.loadAccessToken()
    if (!accessToken) return
    let cancelled = false
    getSync(accessToken).then(result => {
      if (cancelled || !result) return
      if (isTimeEntryDataEmpty(days, daysOff) && !isTimeEntryDataEmpty(result.data.days, result.data.daysOff)) {
        onRestore(result.data)
        // Mark the restored data as already synced so it doesn't immediately
        // get pushed back up as a "local change".
        syncedSnapshotRef.current = JSON.stringify(result.data)
        syncedEntriesSnapshotRef.current = JSON.stringify({ days: result.data.days, daysOff: result.data.daysOff })
      }
      if (result.lastSyncedAt) setLastSyncedAt(new Date(result.lastSyncedAt))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on enable; days/daysOff/onRestore read via closure are checked at that moment, not tracked as deps (mirrors the hourly-heartbeat effect's use of latestDataRef)
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
