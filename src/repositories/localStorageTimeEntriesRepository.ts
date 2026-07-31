import type { TimeEntriesData } from '../types'
import type { TimeEntriesRepository } from './types'

const STORAGE_KEY = 'timeforge'

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
