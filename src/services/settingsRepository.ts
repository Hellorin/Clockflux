import type { Settings } from '../types'

const STORAGE_KEY = 'timeforgeSettings'

export function loadSettingsRaw(): Partial<Settings> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
