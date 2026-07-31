import type { PreferencesRepository } from './types'

const STORAGE_KEY = 'hoursFormat'

export const localStoragePreferencesRepository: PreferencesRepository = {
  loadHoursFormat(): string | null {
    return localStorage.getItem(STORAGE_KEY)
  },
  saveHoursFormat(value: string): void {
    localStorage.setItem(STORAGE_KEY, value)
  },
}
