import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { localStorageTimeEntriesRepository } from './localStorageTimeEntriesRepository'
import { localStorageSettingsRepository } from './localStorageSettingsRepository'
import { localStorageSyncRepository } from './localStorageSyncRepository'
import { localStoragePreferencesRepository } from './localStoragePreferencesRepository'
import { localStorageOwnershipRepository } from './localStorageOwnershipRepository'
import { isStorageWriteFailing, resetStorageHealth } from '../utils/storageHealth'
import { checkIn } from '../services/timeTrackingService'
import type { Settings, TimeEntriesData } from '../types'

/**
 * Five of the eight repositories wrote to localStorage with no try/catch, while
 * the auth one had guarded its writes all along — so this was inconsistency
 * rather than policy.
 *
 * Two concrete failures came out of that. A QuotaExceededError on the
 * time-entries write propagated out of a React state updater (timeTrackingService
 * calls save() from inside setData), so tapping check-in threw during the render
 * phase and white-screened the whole app to the ErrorBoundary — whose copy then
 * told the user their hours were still safe on this device. And in a browser
 * that blocks storage outright, merely *reading* the hours-format preference
 * threw SecurityError from a useState initializer, killing the very first
 * render before anything was painted.
 */

const QUOTA_ERROR = new DOMException('quota exceeded', 'QuotaExceededError')
const SECURITY_ERROR = new DOMException('blocked', 'SecurityError')

const settings: Settings = {
  annualHolidayAllowance: 25,
  employmentStartDate: null,
  holidayAccrualMode: 'gradual',
  themeLightColor: null,
  themeDarkColor: null,
  dailyTargetHours: 8,
  holidayCarryoverEnabled: false,
}

beforeEach(() => {
  localStorage.clear()
  resetStorageHealth()
})

afterEach(() => {
  vi.restoreAllMocks()
  resetStorageHealth()
})

function throwOnWrite(error: DOMException) {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw error
  })
}

describe('writes when storage is full', () => {
  const cases: [string, () => void][] = [
    ['time entries', () => localStorageTimeEntriesRepository.save({ days: {}, daysOff: {} })],
    ['settings', () => localStorageSettingsRepository.save(settings)],
    ['sync snapshot', () => localStorageSyncRepository.saveLastSyncedSnapshot('{}')],
    ['hours format', () => localStoragePreferencesRepository.saveHoursFormat('decimal')],
    ['data owner', () => localStorageOwnershipRepository.saveOwnerId('google-123')],
    [
      'owner backup',
      () =>
        localStorageOwnershipRepository.saveBackup('google-123', {
          days: {},
          daysOff: {},
          settings,
        }),
    ],
  ]

  it.each(cases)('%s: does not throw', (_name, write) => {
    throwOnWrite(QUOTA_ERROR)
    expect(write).not.toThrow()
  })

  it.each(cases)('%s: reports the failure so the UI can warn', (_name, write) => {
    throwOnWrite(QUOTA_ERROR)
    write()
    expect(isStorageWriteFailing()).toBe(true)
  })
})

describe('check-in with storage full', () => {
  // The clock is pinned because checkIn legitimately refuses on a weekend, so
  // without this the test passes Monday to Friday and fails at the weekend —
  // which is exactly what it did the first time a run crossed into a Saturday.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 12, 9, 0, 0)) // Wednesday
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('still records the session in memory instead of crashing', () => {
    throwOnWrite(QUOTA_ERROR)
    const empty: TimeEntriesData = { days: {}, daysOff: {} }

    // This is the exact path that used to throw from inside React's render
    // phase and take the whole app down.
    let next: TimeEntriesData | undefined
    expect(() => {
      next = checkIn(empty)
    }).not.toThrow()

    // The session is still tracked for this tab — the user isn't blocked from
    // working, they're warned that it won't survive a reload.
    expect(Object.values(next!.days).flat()).toHaveLength(1)
    expect(isStorageWriteFailing()).toBe(true)
  })
})

describe('reads when storage access itself is blocked', () => {
  it('hours format returns null rather than throwing during first render', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw SECURITY_ERROR
    })
    expect(() => localStoragePreferencesRepository.loadHoursFormat()).not.toThrow()
    expect(localStoragePreferencesRepository.loadHoursFormat()).toBeNull()
  })
})

describe('recovery', () => {
  it('clears the warning once a write succeeds again', () => {
    throwOnWrite(QUOTA_ERROR)
    localStoragePreferencesRepository.saveHoursFormat('decimal')
    expect(isStorageWriteFailing()).toBe(true)

    // A quota error often clears once the user frees space elsewhere on the
    // origin; a stale banner would train people to ignore it.
    vi.restoreAllMocks()
    localStoragePreferencesRepository.saveHoursFormat('decimal')
    expect(isStorageWriteFailing()).toBe(false)
  })

  it('stays quiet while writes are working', () => {
    localStorageTimeEntriesRepository.save({ days: {}, daysOff: {} })
    expect(isStorageWriteFailing()).toBe(false)
  })
})
