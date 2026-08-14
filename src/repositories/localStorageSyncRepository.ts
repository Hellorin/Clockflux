import { guardedWrite } from '../utils/storageHealth'
import type { SyncRepository } from './types'

// Exported so the privacy notice in index.html can be checked against the keys
// actually in use — see src/test/indexHtml.test.ts.
export const STORAGE_KEY = 'appLastSyncedSnapshot'

export const localStorageSyncRepository: SyncRepository = {
  loadLastSyncedSnapshot(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  },
  saveLastSyncedSnapshot(value: string): void {
    // This snapshot is the largest thing the app writes — it's the full
    // days/daysOff/settings payload — so it is the most likely of all these
    // keys to be the one that trips a quota limit.
    guardedWrite(() => localStorage.setItem(STORAGE_KEY, value))
  },
  clearLastSyncedSnapshot(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to do if storage is unavailable. Not routed through
      // guardedWrite: failing to *remove* a key doesn't risk losing data the
      // user entered, so it shouldn't raise the "not saved" warning.
    }
  },
}
