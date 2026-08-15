import { useCallback, useEffect, useRef, useState } from 'react'
import * as authService from '../services/authService'
import { getSync, pushSync } from '../services/syncService'
import { localStorageSyncRepository } from '../repositories/localStorageSyncRepository'
import type { DaysMap, DaysOffMap, Settings, SyncData } from '../types'

const AUTO_SYNC_INTERVAL_MS = 60 * 60 * 1000 // every hour
const ENTRY_CHANGE_DEBOUNCE_MS = 800 // check in/out or a day-off edit: sync almost immediately
const SETTINGS_CHANGE_DEBOUNCE_MS = 5000 // settings fields can be typed into, so wait for a pause

// What a device that has never synced before is assumed to already agree
// with: nothing. Used as the baseline when localStorage has no persisted
// one yet, so the very first reconcile treats any existing local data as
// "diverged from empty" (upload it) rather than comparing against nothing.
function emptyBaseline(settings: Settings): string {
  return JSON.stringify({ days: {}, daysOff: {}, settings })
}

interface UseSyncArgs {
  enabled: boolean
  days: DaysMap
  daysOff: DaysOffMap
  settings: Settings
  // Called whenever reconciliation decides the server's data should replace
  // what's on screen — a fresh/cleared browser, a device that's fallen
  // behind another device's changes, or a Pro plan regained after a Free
  // lapse where nothing changed locally in the meantime.
  onRestore: (data: SyncData) => void
}

/**
 * Keeps local time-tracking + settings data and the backend's copy
 * reconciled for Pro users: automatically an hour after the last sync,
 * shortly after a local change, when the tab is hidden, and on demand via
 * syncNow(). Reconciliation compares both sides against the last snapshot
 * this device is known to have agreed with the server on (persisted across
 * reloads — see localStorageSyncRepository):
 *   - neither side changed since then → nothing to do.
 *   - only local changed → push (safe: nobody else has moved the server).
 *   - only the server changed → pull and adopt it via onRestore (covers a
 *     fresh device, a device that fell behind, and re-upgrading to Pro
 *     after a Free lapse without local edits in between).
 *   - both changed → a genuine concurrent edit. This is the one case with
 *     no real merge: local wins, same as before, but now it's a narrow
 *     fallback instead of what happens on every single reload.
 */
/**
 * Which direction of sync last failed. Every call in syncService swallows its
 * error and returns null, so without this the hook reported a perfectly
 * healthy-looking state — isSyncing false, no error anywhere — while nothing
 * had actually reached the server. For a paid feature whose whole promise is
 * "your data is safe across devices", that silence is the bug.
 */
export type SyncError = 'push' | 'pull' | 'conflict'

export function useSync({ enabled, days, daysOff, settings, onRestore }: UseSyncArgs) {
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<SyncError | null>(null)

  const isSyncingRef = useRef(false)
  const baselineRef = useRef<string | null>(null)
  // The server version this device's baseline corresponds to, sent as the push
  // precondition. Three distinct states, and conflating them is how data gets
  // lost:
  //   undefined — never successfully read the server. Pushing unconditionally
  //               here would blindly overwrite whatever is actually stored,
  //               which is the very thing the precondition exists to prevent,
  //               so syncNow re-reads first.
  //   null      — the server confirmed it holds nothing for this user, so an
  //               unconditional first write is correct.
  //   string    — a known version to make the write conditional on.
  //
  // A ref rather than state because syncNow reads it at call time from inside
  // timers and event handlers, where a captured state value would be stale.
  const serverVersionRef = useRef<string | null | undefined>(undefined)
  const latestDataRef = useRef<SyncData>({ days, daysOff, settings })
  latestDataRef.current = { days, daysOff, settings }

  const snapshot = JSON.stringify(latestDataRef.current)
  const entriesSnapshot = JSON.stringify({ days, daysOff })
  // Before a baseline has ever been established (never synced on this
  // device, or the initial pull hasn't resolved yet), fall back to comparing
  // against "nothing", so genuinely unsynced local data still reads as
  // dirty instead of silently not counting until the first successful sync.
  const isDirty = (baselineRef.current ?? emptyBaseline(settings)) !== snapshot

  function setBaseline(value: string) {
    baselineRef.current = value
    localStorageSyncRepository.saveLastSyncedSnapshot(value)
  }

  // Pushes the current local data and, on success, marks it as the new
  // baseline. Returns whether the push actually succeeded, so callers (e.g.
  // sign-out) can tell a confirmed-clean sync apart from a failed/offline one.
  const syncNow = useCallback(async (force = false): Promise<boolean> => {
    if (isSyncingRef.current) return false
    const accessToken = authService.loadAccessToken()
    if (!accessToken) return false

    const payload = latestDataRef.current
    const payloadSnapshot = JSON.stringify(payload)
    if (!force && baselineRef.current === payloadSnapshot) return true

    isSyncingRef.current = true
    setIsSyncing(true)
    try {
      // The initial pull failed (or hasn't happened), so this device has no
      // idea what the server holds. Read it before writing rather than pushing
      // unconditionally over it — the hourly heartbeat and the change debounce
      // both land here, so without this a device that merely failed its first
      // pull would still clobber every other device.
      if (serverVersionRef.current === undefined) {
        const current = await getSync(accessToken)
        if (!current) {
          setSyncError('pull')
          return false
        }
        serverVersionRef.current = current.lastSyncedAt
      }

      const result = await pushSync(accessToken, payload, serverVersionRef.current)

      if (result.status === 'conflict') {
        // Another device wrote since this one last read. Previously there was
        // no way to find this out — the push simply won and destroyed their
        // work. Adopt the server's copy, which is the same rule the
        // reconcile-on-enable effect below applies when only the server has
        // changed, and report it so the UI doesn't claim a clean sync.
        onRestore(result.server.data)
        serverVersionRef.current = result.server.lastSyncedAt
        setBaseline(JSON.stringify(result.server.data))
        if (result.server.lastSyncedAt) setLastSyncedAt(new Date(result.server.lastSyncedAt))
        setSyncError('conflict')
        return false
      }

      if (result.status === 'failed') {
        setSyncError('push')
        return false
      }

      setSyncError(null)
      setBaseline(payloadSnapshot)
      serverVersionRef.current = result.lastSyncedAt
      setLastSyncedAt(new Date(result.lastSyncedAt))
      return true
    } finally {
      isSyncingRef.current = false
      setIsSyncing(false)
    }
    // onRestore is intentionally read from the closure rather than declared as
    // a dependency, matching how this hook already treats it in the reconcile
    // effect below — App passes a fresh arrow function on every render, so
    // depending on it would rebuild syncNow constantly and reset every timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Runs once per "enabled" transition: loads the persisted baseline, pulls
  // the server snapshot, and reconciles the two per the rules in the doc
  // comment above.
  useEffect(() => {
    if (!enabled) return
    const accessToken = authService.loadAccessToken()
    if (!accessToken) return
    let cancelled = false

    baselineRef.current = localStorageSyncRepository.loadLastSyncedSnapshot()

    getSync(accessToken).then(result => {
      if (cancelled) return
      // A null result here is always a failure, never "nothing stored yet" —
      // the backend answers 200 with empty data for a user who has never
      // synced. Reporting it matters because the reconcile below then can't
      // tell whether the server has newer data, so it quietly does nothing.
      setSyncError(result ? null : 'pull')
      if (result?.lastSyncedAt) setLastSyncedAt(new Date(result.lastSyncedAt))
      // Records the version every later push is conditional on — but only on a
      // successful read. `result?.lastSyncedAt ?? null` would collapse a failed
      // pull into "the server holds nothing", and the next heartbeat would then
      // push unconditionally over data it never managed to read. Left as
      // undefined, syncNow re-reads before writing instead.
      if (result) serverVersionRef.current = result.lastSyncedAt

      const baseline = baselineRef.current ?? emptyBaseline(latestDataRef.current.settings)
      const serverData = result?.data ?? { days: {}, daysOff: {}, settings: latestDataRef.current.settings }
      const serverSnapshot = result ? JSON.stringify(serverData) : baseline
      const localSnapshot = JSON.stringify(latestDataRef.current)

      const serverChanged = serverSnapshot !== baseline
      const localChanged = localSnapshot !== baseline

      if (serverChanged && !localChanged) {
        onRestore(serverData)
        setBaseline(serverSnapshot)
      } else if (localChanged) {
        // Covers "only local changed" (safe push) and "both changed"
        // (accepted residual conflict risk — local wins).
        syncNow(true)
      } else if (baselineRef.current === null) {
        // Neither side has any data yet; nothing to reconcile, but record a
        // baseline so the next reload doesn't repeat this pull for nothing.
        setBaseline(baseline)
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on enable; days/daysOff/settings/onRestore/syncNow read via closure/ref are checked at that moment, not tracked as deps (mirrors the hourly-heartbeat effect's use of latestDataRef)
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
    if (!enabled || baselineRef.current === null) return
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

  // Best-effort flush when the tab is backgrounded/closed, so an edit made
  // right before switching away or closing doesn't sit unsynced for up to
  // an hour waiting on the heartbeat.
  useEffect(() => {
    if (!enabled) return
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') syncNow()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [enabled, syncNow])

  return { lastSyncedAt, isSyncing, isDirty, syncError, syncNow }
}
