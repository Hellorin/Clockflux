import type { Settings } from '../types'
import type { SettingsRepository } from './types'

const STORAGE_KEY = 'timeforgeSettings'

export const localStorageSettingsRepository: SettingsRepository = {
  loadRaw(): Partial<Settings> | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  save(settings: Settings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  },
}
