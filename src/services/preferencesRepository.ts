const STORAGE_KEY = 'hoursFormat'

export function loadHoursFormat(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function saveHoursFormat(value: string): void {
  localStorage.setItem(STORAGE_KEY, value)
}
