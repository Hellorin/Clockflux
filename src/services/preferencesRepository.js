const STORAGE_KEY = 'hoursFormat'

export function loadHoursFormat() {
  return localStorage.getItem(STORAGE_KEY)
}

export function saveHoursFormat(value) {
  localStorage.setItem(STORAGE_KEY, value)
}
