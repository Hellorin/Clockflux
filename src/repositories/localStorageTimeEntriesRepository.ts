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
  save(data: TimeEntriesData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  },
}
