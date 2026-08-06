import type { AuthUser, Settings, TimeEntriesData } from '../types'

export interface TimeEntriesRepository {
  load(): TimeEntriesData | null
  save(data: TimeEntriesData): void
}

export interface SettingsRepository {
  loadRaw(): Partial<Settings> | null
  save(settings: Settings): void
}

export interface PreferencesRepository {
  loadHoursFormat(): string | null
  saveHoursFormat(value: string): void
}

export interface VisitRepository {
  hasVisited(): boolean
  markVisited(): void
}

export interface AuthRepository {
  loadUser(): AuthUser | null
  saveUser(user: AuthUser): void
  clearUser(): void
}
