import { localStorageSettingsRepository } from '../repositories/localStorageSettingsRepository'
import type { SettingsRepository } from '../repositories/types'
import type { Settings } from '../types'

// Single seam for choosing which store backs settings. Everyone is on local
// storage today; once persistence is a paid feature, this is where we'd
// branch to a backend-backed repository per user/plan instead of changing
// every call site below.
function resolveRepository(): SettingsRepository {
  return localStorageSettingsRepository
}

export function loadSettingsRaw(): Partial<Settings> | null {
  return resolveRepository().loadRaw()
}

export function saveSettings(settings: Settings): void {
  resolveRepository().save(settings)
}
