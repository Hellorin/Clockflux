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

// Tracks whether this browser has installed Clockflux as a PWA (or dismissed
// the offer), so useInstallPrompt knows whether to show the install banner
// again on a later visit. See services/installService.ts.
export interface InstallRepository {
  hasInstalled(): boolean
  markInstalled(): void
  wasDismissed(): boolean
  markDismissed(): void
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

// Tracks, per device, the last SyncData snapshot this device knows to be in
// sync with the backend — either just pushed, or just pulled. Survives
// reloads (unlike an in-memory ref), so useSync can tell "nothing changed
// since last time" from "something changed" instead of treating every page
// load as a fresh push. See useSync.ts's reconcile-on-enable logic.
export interface SyncRepository {
  loadLastSyncedSnapshot(): string | null
  saveLastSyncedSnapshot(value: string): void
  clearLastSyncedSnapshot(): void
}

// One device's local time-entries/settings data belongs to whichever account
// last claimed it — tracked here so a second, different account signing in
// on the same browser never inherits (or overwrites) the first account's
// data. See services/localDataOwnershipService.ts.
export interface OwnershipRepository {
  loadOwnerId(): string | null
  saveOwnerId(ownerId: string): void
  loadBackup(ownerId: string): TimeEntriesData & { settings: Settings } | null
  saveBackup(ownerId: string, data: TimeEntriesData & { settings: Settings }): void
  clearBackup(ownerId: string): void
}
