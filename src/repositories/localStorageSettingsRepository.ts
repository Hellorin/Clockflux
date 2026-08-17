import { guardedWrite } from '../utils/storageHealth'
import type { Settings } from '../types'
import type { SettingsRepository } from './types'

// Exported so the privacy notice in index.html can be checked against the keys
// actually in use — see src/test/indexHtml.test.ts.
export const STORAGE_KEY = 'appSettings'

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
    guardedWrite(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)))
  },
}
