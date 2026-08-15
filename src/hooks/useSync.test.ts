import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSync } from './useSync'
import * as authService from '../services/authService'
import * as syncService from '../services/syncService'
import { localStorageSyncRepository } from '../repositories/localStorageSyncRepository'

vi.mock('../services/authService')
vi.mock('../services/syncService')

const ENTRY_DEBOUNCE_MS = 800
const SETTINGS_DEBOUNCE_MS = 5000
const HOUR_MS = 60 * 60 * 1000

const settings = { annualHolidayAllowance: 25, employmentStartDate: null, holidayAccrualMode: 'gradual' as const, themeLightColor: null, themeDarkColor: null, dailyTargetHours: 8, holidayCarryoverEnabled: false }

function baseArgs(overrides: Partial<Parameters<typeof useSync>[0]> = {}) {
  return { enabled: true, days: {}, daysOff: {}, settings, onRestore: vi.fn(), ...overrides }
}

describe('useSync', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(authService.loadAccessToken).mockReturnValue('token-123')
    // "Signed in, Pro, but has never synced from any device." Note this is
    // NOT null: getSync returns null only on *failure*, whereas the backend
    // answers 200 with empty data for a user with nothing stored (see the
    // comment on the reconcile effect in useSync.ts). The default used to be
    // null, which meant every test that expected a push was quietly asserting
    // that a device pushes even when it could not read the server — the exact
    // behaviour that made a failed pull clobber other devices.
    vi.mocked(syncService.getSync).mockResolvedValue({
      data: { days: {}, daysOff: {}, settings },
      lastSyncedAt: null,
    })
    vi.mocked(syncService.pushSync).mockResolvedValue({ status: 'ok', lastSyncedAt: '2026-08-11T10:00:00Z' })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('does nothing when disabled', async () => {
    renderHook(() => useSync(baseArgs({ enabled: false })))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HOUR_MS)
    })
    expect(syncService.getSync).not.toHaveBeenCalled()
    expect(syncService.pushSync).not.toHaveBeenCalled()
  })

  it('seeds lastSyncedAt from the server once enabled', async () => {
    vi.mocked(syncService.getSync).mockResolvedValue({ data: { days: {}, daysOff: {}, settings }, lastSyncedAt: '2026-08-11T09:00:00Z' })
    const { result } = renderHook(() => useSync(baseArgs()))

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.lastSyncedAt).toEqual(new Date('2026-08-11T09:00:00Z'))
  })

  it('restores server data once when local is empty on enable', async () => {
    const remoteData = {
      days: { '2026-08-10': [{ checkIn: '2026-08-10T09:00:00Z', checkOut: '2026-08-10T17:00:00Z' }] },
      daysOff: { '2026-08-07': 'personal' as const },
      settings,
    }
    vi.mocked(syncService.getSync).mockResolvedValue({ data: remoteData, lastSyncedAt: '2026-08-11T09:00:00Z' })
    const onRestore = vi.fn()
    renderHook(() => useSync(baseArgs({ onRestore })))

    await act(async () => {
      await Promise.resolve()
    })

    expect(onRestore).toHaveBeenCalledWith(remoteData)
  })

  it('pushes local data instead of restoring when both local and server have diverged from a never-synced baseline', async () => {
    // Regression case for the "both changed" conflict fallback: a device
    // that has never synced before, with its own local history, whose
    // account already has different data on the server (e.g. from another
    // device). There's no shared baseline to reconcile against, so local
    // wins rather than being silently discarded.
    const remoteData = { days: { '2026-08-10': [{ checkIn: '2026-08-10T09:00:00Z', checkOut: null }] }, daysOff: {}, settings }
    vi.mocked(syncService.getSync).mockResolvedValue({ data: remoteData, lastSyncedAt: '2026-08-11T09:00:00Z' })
    const onRestore = vi.fn()
    const localDays = { '2026-08-11': [{ checkIn: '2026-08-11T09:00:00Z', checkOut: null }] }
    renderHook(() => useSync(baseArgs({ onRestore, days: localDays })))

    await act(async () => {
      await Promise.resolve()
    })

    expect(onRestore).not.toHaveBeenCalled()
    // Conditional on the version just pulled: a push that isn't would go back
    // to blindly overwriting whatever another device wrote in the meantime.
    expect(syncService.pushSync).toHaveBeenCalledWith(
      'token-123',
      { days: localDays, daysOff: {}, settings },
      '2026-08-11T09:00:00Z'
    )
  })

  it('does not push on a fresh mount/reload when nothing has changed since the last known sync', async () => {
    // Regression test: syncedSnapshotRef used to reset to null on every
    // mount, so even an unchanged, already-synced device would push on
    // every reload. The persisted baseline should recognize "nothing to do".
    localStorageSyncRepository.saveLastSyncedSnapshot(JSON.stringify({ days: {}, daysOff: {}, settings }))
    vi.mocked(syncService.getSync).mockResolvedValue({ data: { days: {}, daysOff: {}, settings }, lastSyncedAt: '2026-08-11T09:00:00Z' })

    renderHook(() => useSync(baseArgs()))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HOUR_MS)
    })

    expect(syncService.pushSync).not.toHaveBeenCalled()
  })

  it('pulls a stale device up to date even when local already has some (older) data', async () => {
    // Regression test: the old "restore only if local is empty" check meant
    // a device with any existing data (not just a totally fresh one) never
    // pulled changes made elsewhere — it just kept pushing its own stale
    // view. A persisted baseline that matches local-but-not-server should
    // still trigger a restore.
    const staleLocalDays = { '2026-08-01': [{ checkIn: '2026-08-01T09:00:00Z', checkOut: '2026-08-01T17:00:00Z' }] }
    localStorageSyncRepository.saveLastSyncedSnapshot(JSON.stringify({ days: staleLocalDays, daysOff: {}, settings }))
    const newerRemoteData = {
      days: { ...staleLocalDays, '2026-08-10': [{ checkIn: '2026-08-10T09:00:00Z', checkOut: null }] },
      daysOff: {},
      settings,
    }
    vi.mocked(syncService.getSync).mockResolvedValue({ data: newerRemoteData, lastSyncedAt: '2026-08-11T09:00:00Z' })
    const onRestore = vi.fn()

    renderHook(() => useSync(baseArgs({ onRestore, days: staleLocalDays })))

    await act(async () => {
      await Promise.resolve()
    })

    expect(onRestore).toHaveBeenCalledWith(newerRemoteData)
    expect(syncService.pushSync).not.toHaveBeenCalled()
  })

  it('uploads pre-existing local history on the very first sync (e.g. free -> Pro upgrade)', async () => {
    const localDays = { '2026-08-01': [{ checkIn: '2026-08-01T09:00:00Z', checkOut: '2026-08-01T17:00:00Z' }] }
    // The very first sync: the server holds nothing for this user yet, so
    // the initial pull succeeds and reports lastSyncedAt: null.
    vi.mocked(syncService.getSync).mockResolvedValue({
      data: { days: {}, daysOff: {}, settings },
      lastSyncedAt: null,
    })

    renderHook(() => useSync(baseArgs({ days: localDays })))

    await act(async () => {
      await Promise.resolve()
    })

    expect(syncService.pushSync).toHaveBeenCalledWith('token-123', { days: localDays, daysOff: {}, settings }, null)
  })

  it('syncs almost immediately after a check-in/check-out (a days change)', async () => {
    // Get past the initial mount's own reconcile so this test isolates the change itself.
    const { rerender } = renderHook((props: Parameters<typeof useSync>[0]) => useSync(props), {
      initialProps: baseArgs(),
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENTRY_DEBOUNCE_MS)
    })
    vi.mocked(syncService.pushSync).mockClear()

    rerender(baseArgs({ days: { '2026-08-11': [{ checkIn: '2026-08-11T09:00:00Z', checkOut: null }] } }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENTRY_DEBOUNCE_MS)
    })

    expect(syncService.pushSync).toHaveBeenCalledWith(
      'token-123',
      {
        days: { '2026-08-11': [{ checkIn: '2026-08-11T09:00:00Z', checkOut: null }] },
        daysOff: {},
        settings,
      },
      // Unconditional: this user has never synced, so there is no version to
      // be conditional on.
      null
    )
  })

  it('syncs almost immediately after a day-off is added (a daysOff change)', async () => {
    const { rerender } = renderHook((props: Parameters<typeof useSync>[0]) => useSync(props), {
      initialProps: baseArgs(),
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENTRY_DEBOUNCE_MS)
    })
    vi.mocked(syncService.pushSync).mockClear()

    rerender(baseArgs({ daysOff: { '2026-08-11': 'personal' } }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENTRY_DEBOUNCE_MS)
    })

    expect(syncService.pushSync).toHaveBeenCalledWith('token-123', { days: {}, daysOff: { '2026-08-11': 'personal' }, settings }, null)
  })

  it('waits longer before syncing a settings-only change than an entries change', async () => {
    const { rerender } = renderHook((props: Parameters<typeof useSync>[0]) => useSync(props), {
      initialProps: baseArgs(),
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENTRY_DEBOUNCE_MS)
    })
    vi.mocked(syncService.pushSync).mockClear()

    rerender(baseArgs({ settings: { ...settings, annualHolidayAllowance: 30 } }))

    // Shortly after: not yet synced, since only the slower settings debounce applies.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENTRY_DEBOUNCE_MS)
    })
    expect(syncService.pushSync).not.toHaveBeenCalled()

    // Once the longer settings debounce elapses, it syncs.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTINGS_DEBOUNCE_MS)
    })
    expect(syncService.pushSync).toHaveBeenCalledWith('token-123', { days: {}, daysOff: {}, settings: { ...settings, annualHolidayAllowance: 30 } }, null)
  })

  it('syncs on the hourly heartbeat when a change was made', async () => {
    const { rerender } = renderHook((props: Parameters<typeof useSync>[0]) => useSync(props), {
      initialProps: baseArgs(),
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENTRY_DEBOUNCE_MS)
    })
    vi.mocked(syncService.pushSync).mockClear()

    rerender(baseArgs({ days: { '2026-08-11': [{ checkIn: '2026-08-11T09:00:00Z', checkOut: null }] } }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HOUR_MS)
    })

    expect(syncService.pushSync).toHaveBeenCalledTimes(1)
  })

  it('skips a no-op push once already in sync, but syncNow(true) forces it', async () => {
    const localDays = { '2026-08-01': [{ checkIn: '2026-08-01T09:00:00Z', checkOut: '2026-08-01T17:00:00Z' }] }
    const { result } = renderHook(() => useSync(baseArgs({ days: localDays })))

    await act(async () => {
      await Promise.resolve()
    })
    expect(syncService.pushSync).toHaveBeenCalledTimes(1)

    // Nothing changed since the last successful push: the hourly heartbeat should skip it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HOUR_MS)
    })
    expect(syncService.pushSync).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.syncNow(true)
    })
    expect(syncService.pushSync).toHaveBeenCalledTimes(2)
  })

  it('sets isSyncing while a push is in flight', async () => {
    let resolvePush!: (value: syncService.PushSyncResult) => void
    vi.mocked(syncService.pushSync).mockReturnValue(new Promise(resolve => { resolvePush = resolve }))

    const { result } = renderHook(() => useSync(baseArgs()))

    let syncPromise!: Promise<boolean>
    act(() => {
      syncPromise = result.current.syncNow(true)
    })
    expect(result.current.isSyncing).toBe(true)

    await act(async () => {
      resolvePush({ status: 'ok', lastSyncedAt: '2026-08-11T10:00:00Z' })
      await syncPromise
    })
    expect(result.current.isSyncing).toBe(false)
  })

  it('syncNow resolves false and leaves data dirty when the push fails (e.g. offline)', async () => {
    vi.mocked(syncService.pushSync).mockResolvedValue({ status: 'failed' })
    const localDays = { '2026-08-01': [{ checkIn: '2026-08-01T09:00:00Z', checkOut: '2026-08-01T17:00:00Z' }] }
    const { result } = renderHook(() => useSync(baseArgs({ days: localDays })))

    let succeeded: boolean | undefined
    await act(async () => {
      succeeded = await result.current.syncNow(true)
    })

    expect(succeeded).toBe(false)
    expect(result.current.isDirty).toBe(true)
  })

  it('flushes a pending change when the tab is hidden', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const { rerender } = renderHook((props: Parameters<typeof useSync>[0]) => useSync(props), {
      initialProps: baseArgs(),
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENTRY_DEBOUNCE_MS)
    })
    vi.mocked(syncService.pushSync).mockClear()

    rerender(baseArgs({ days: { '2026-08-11': [{ checkIn: '2026-08-11T09:00:00Z', checkOut: null }] } }))

    const handler = addSpy.mock.calls.find(([type]) => type === 'visibilitychange')?.[1] as EventListener
    expect(handler).toBeTypeOf('function')
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })

    await act(async () => {
      handler(new Event('visibilitychange'))
      await Promise.resolve()
    })

    expect(syncService.pushSync).toHaveBeenCalledWith(
      'token-123',
      {
        days: { '2026-08-11': [{ checkIn: '2026-08-11T09:00:00Z', checkOut: null }] },
        daysOff: {},
        settings,
      },
      // Unconditional: this user has never synced, so there is no version to
      // be conditional on.
      null
    )
    addSpy.mockRestore()
  })
  // Every call in syncService swallows its own error and returns null, so
  // before this the hook reported a clean state while nothing had reached the
  // server. For a paid feature whose entire promise is durability, that
  // silence was the bug.
  describe('failure reporting', () => {
    it('reports a failed push', async () => {
      vi.mocked(syncService.getSync).mockResolvedValue({
        data: { days: {}, daysOff: {}, settings },
        lastSyncedAt: '2026-08-11T10:00:00Z',
      })
      vi.mocked(syncService.pushSync).mockResolvedValue({ status: 'failed' })

      const { result } = renderHook(() => useSync(baseArgs()))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.syncError).toBeNull()

      await act(async () => {
        await result.current.syncNow(true)
      })

      expect(result.current.syncError).toBe('push')
      // The data is still unsynced, so this must not look settled.
      expect(result.current.isSyncing).toBe(false)
    })

    it('reports a failed initial pull', async () => {
      // null here means the pull *failed*, which is what this test is about.
      vi.mocked(syncService.getSync).mockResolvedValue(null)

      const { result } = renderHook(() => useSync(baseArgs()))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(result.current.syncError).toBe('pull')
    })

    it('clears the error once a sync succeeds again', async () => {
      vi.mocked(syncService.getSync).mockResolvedValue(null)
      const { result } = renderHook(() => useSync(baseArgs()))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.syncError).toBe('pull')

      // Recovery now requires the *read* to work again, not just the write:
      // syncNow refuses to push while it has never managed to see the server,
      // because doing so would overwrite data it cannot account for.
      vi.mocked(syncService.getSync).mockResolvedValue({
        data: { days: {}, daysOff: {}, settings },
        lastSyncedAt: '2026-08-11T10:00:00Z',
      })
      vi.mocked(syncService.pushSync).mockResolvedValue({ status: 'ok', lastSyncedAt: '2026-08-11T11:00:00Z' })
      await act(async () => {
        await result.current.syncNow(true)
      })

      expect(result.current.syncError).toBeNull()
    })

    it('reports no error when everything works', async () => {
      vi.mocked(syncService.getSync).mockResolvedValue({
        data: { days: {}, daysOff: {}, settings },
        lastSyncedAt: '2026-08-11T10:00:00Z',
      })

      const { result } = renderHook(() => useSync(baseArgs()))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ENTRY_DEBOUNCE_MS)
      })

      expect(result.current.syncError).toBeNull()
    })
  })

  // The whole reason the precondition exists. Before it, a device whose tab had
  // been open all day would push on its next heartbeat and silently replace
  // everything another device had written since — for a paid feature whose
  // entire promise is that your data survives across devices.
  describe('conflicts', () => {
    const serverData = {
      days: { '2026-08-12': [{ checkIn: '2026-08-12T09:00:00Z', checkOut: null }] },
      daysOff: {},
      settings,
    }

    function mockConflict() {
      vi.mocked(syncService.getSync).mockResolvedValue({
        data: { days: {}, daysOff: {}, settings },
        lastSyncedAt: '2026-08-11T10:00:00Z',
      })
      vi.mocked(syncService.pushSync).mockResolvedValue({
        status: 'conflict',
        server: { data: serverData, lastSyncedAt: '2026-08-12T10:00:00Z' },
      })
    }

    it('adopts the server copy rather than overwriting it', async () => {
      mockConflict()
      const onRestore = vi.fn()

      const { result } = renderHook(() => useSync(baseArgs({ onRestore })))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await result.current.syncNow(true)
      })

      expect(onRestore).toHaveBeenCalledWith(serverData)
    })

    it('reports the conflict rather than claiming a clean sync', async () => {
      mockConflict()

      const { result } = renderHook(() => useSync(baseArgs()))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      let pushed: boolean | undefined
      await act(async () => {
        pushed = await result.current.syncNow(true)
      })

      expect(pushed).toBe(false)
      expect(result.current.syncError).toBe('conflict')
    })

    it('adopts the server version so the next push is conditional on it', async () => {
      // Staying on the stale version would make every subsequent push conflict
      // too, leaving the device permanently unable to sync.
      mockConflict()

      const { result } = renderHook(() => useSync(baseArgs()))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await result.current.syncNow(true)
      })

      vi.mocked(syncService.pushSync).mockClear()
      vi.mocked(syncService.pushSync).mockResolvedValue({ status: 'ok', lastSyncedAt: '2026-08-12T11:00:00Z' })
      await act(async () => {
        await result.current.syncNow(true)
      })

      expect(syncService.pushSync).toHaveBeenCalledWith(
        'token-123',
        expect.anything(),
        '2026-08-12T10:00:00Z'
      )
    })
  })
})
