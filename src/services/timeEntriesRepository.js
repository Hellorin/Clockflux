const STORAGE_KEY = 'timeforge'

export function loadTimeEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveTimeEntries(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
