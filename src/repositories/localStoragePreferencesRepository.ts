import { guardedWrite } from '../utils/storageHealth'
import type { PreferencesRepository } from './types'

// Exported so the privacy notice in index.html can be checked against the keys
// actually in use — see src/test/indexHtml.test.ts.
export const STORAGE_KEY = 'hoursFormat'

export const localStoragePreferencesRepository: PreferencesRepository = {
  // The read is guarded, not just the write. In a browser that blocks storage
  // outright (Safari with "Block All Cookies", some embedded webviews) merely
  // *touching* localStorage throws SecurityError — and App.tsx calls this from
  // inside a useState initializer, so the throw happened during the very first
  // render and white-screened the app to the ErrorBoundary before anything was
  // painted. Of all the unguarded accesses this was the worst, because it
  // needed no data and no quota pressure to trigger: just a privacy setting.
  loadHoursFormat(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  },
  saveHoursFormat(value: string): void {
    guardedWrite(() => localStorage.setItem(STORAGE_KEY, value))
  },
}
