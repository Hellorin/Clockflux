import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSync } from './useSync'
import * as authService from '../services/authService'
import * as syncService from '../services/syncService'

vi.mock('../services/authService')
vi.mock('../services/syncService')

const ENTRY_DEBOUNCE_MS = 800
const SETTINGS_DEBOUNCE_MS = 5000
const HOUR_MS = 60 * 60 * 1000

const settings = { annualHolidayAllowance: 25, employmentStartDate: null, holidayAccrualMode: 'gradual' as const }

function baseArgs(overrides: Partial<Parameters<typeof useSync>[0]> = {}) {
  return { enabled: true, days: {}, daysOff: {}, settings, ...overrides }
}

describe('useSync', () => {
  beforeEach(() => {
    vi.mocked(authService.loadAccessToken).mockReturnValue('token-123')
    vi.mocked(syncService.getSync).mockResolvedValue(null)
    vi.mocked(syncService.pushSync).mockResolvedValue({ lastSyncedAt: '2026-08-11T10:00:00Z' })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
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

  it('syncs almost immediately after a check-in/check-out (a days change)', async () => {
    // Get past the initial mount's own pending sync so this test isolates the change itself.
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

    expect(syncService.pushSync).toHaveBeenCalledWith('token-123', {
      days: { '2026-08-11': [{ checkIn: '2026-08-11T09:00:00Z', checkOut: null }] },
      daysOff: {},
      settings,
    })
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

    expect(syncService.pushSync).toHaveBeenCalledWith('token-123', { days: {}, daysOff: { '2026-08-11': 'personal' }, settings })
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
    expect(syncService.pushSync).toHaveBeenCalledWith('token-123', { days: {}, daysOff: {}, settings: { ...settings, annualHolidayAllowance: 30 } })
  })

  it('syncs on the hourly heartbeat when dirty', async () => {
    renderHook(() => useSync(baseArgs()))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HOUR_MS)
    })

    expect(syncService.pushSync).toHaveBeenCalledTimes(1)
  })

  it('skips a no-op push once already in sync, but syncNow(true) forces it', async () => {
    const { result } = renderHook(() => useSync(baseArgs()))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENTRY_DEBOUNCE_MS)
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
    let resolvePush!: (value: { lastSyncedAt: string }) => void
    vi.mocked(syncService.pushSync).mockReturnValue(new Promise(resolve => { resolvePush = resolve }))

    const { result } = renderHook(() => useSync(baseArgs()))

    let syncPromise!: Promise<void>
    act(() => {
      syncPromise = result.current.syncNow(true)
    })
    expect(result.current.isSyncing).toBe(true)

    await act(async () => {
      resolvePush({ lastSyncedAt: '2026-08-11T10:00:00Z' })
      await syncPromise
    })
    expect(result.current.isSyncing).toBe(false)
  })
})
