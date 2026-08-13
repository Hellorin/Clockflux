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
    localStorage.setItem(STORAGE_KEY, value)
  },
  clearLastSyncedSnapshot(): void {
    localStorage.removeItem(STORAGE_KEY)
  },
}
