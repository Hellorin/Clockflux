import type { PreferencesRepository } from './types'

// Exported so the privacy notice in index.html can be checked against the keys
// actually in use — see src/test/indexHtml.test.ts.
export const STORAGE_KEY = 'hoursFormat'

export const localStoragePreferencesRepository: PreferencesRepository = {
  loadHoursFormat(): string | null {
    return localStorage.getItem(STORAGE_KEY)
  },
  saveHoursFormat(value: string): void {
    localStorage.setItem(STORAGE_KEY, value)
  },
}
