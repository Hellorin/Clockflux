import type { TimeEntriesData } from '../types'

const STORAGE_KEY = 'timeforge'

export function loadTimeEntries(): TimeEntriesData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveTimeEntries(data: TimeEntriesData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
