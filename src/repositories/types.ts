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
  loadAccessToken(): string | null
  saveAccessToken(accessToken: string): void
  clearAccessToken(): void
  // Persists past signOut()/session expiry (unlike loadUser/loadAccessToken
  // above, which are cleared then) so the app can tell "never signed in on
  // this device" apart from "signed in before, just not connected right now".
  hasSignedInBefore(): boolean
  markSignedInBefore(): void
}
