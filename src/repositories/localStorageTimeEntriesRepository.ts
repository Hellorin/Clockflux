import { guardedWrite } from '../utils/storageHealth'
import type { TimeEntriesData } from '../types'
import type { TimeEntriesRepository } from './types'

// Exported so the privacy notice in index.html can be checked against the keys
// actually in use — see src/test/indexHtml.test.ts.
export const STORAGE_KEY = 'app'

export const localStorageTimeEntriesRepository: TimeEntriesRepository = {
  load(): TimeEntriesData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  // This is the write on the check-in/check-out path, and it was the only
  // unguarded one that could take the whole app down: timeTrackingService
  // calls it from inside a setData updater, i.e. during React's render phase,
  // so a QuotaExceededError propagated straight to the ErrorBoundary. Tapping
  // check-in white-screened the app — and the crash screen then reassured the
  // user their hours were still saved on this device, which is precisely what
  // had just failed.
  save(data: TimeEntriesData): void {
    guardedWrite(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)))
  },
}
