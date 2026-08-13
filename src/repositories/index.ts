// Concrete implementations live in their own `localStorage*Repository.ts` /
// (future) `http*Repository.ts` files. Which one backs a given piece of
// persisted data is a business decision (e.g. free vs. paid tier), so it's
// resolved inside the relevant service (see `resolveRepository()` in
// timeTrackingService.ts, settingsService.ts, preferencesService.ts,
// visitService.ts) — never picked here and never called directly by a hook or
// component.
export type { TimeEntriesRepository, SettingsRepository, PreferencesRepository, VisitRepository, AuthRepository, SyncRepository, OwnershipRepository } from './types'
