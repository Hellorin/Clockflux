import { localStoragePreferencesRepository } from '../repositories/localStoragePreferencesRepository'
import type { PreferencesRepository } from '../repositories/types'

// Single seam for choosing which store backs preferences. Everyone is on
// local storage today; once persistence is a paid feature, this is where
// we'd branch to a backend-backed repository per user/plan instead of
// changing every call site below.
function resolveRepository(): PreferencesRepository {
  return localStoragePreferencesRepository
}

export function loadHoursFormat(): string | null {
  return resolveRepository().loadHoursFormat()
}

export function saveHoursFormat(value: string): void {
  resolveRepository().saveHoursFormat(value)
}
