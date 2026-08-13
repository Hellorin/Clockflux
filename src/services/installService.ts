import { localStorageInstallRepository } from '../repositories/localStorageInstallRepository'
import type { InstallRepository } from '../repositories/types'

// Single seam for choosing which store records the PWA install state. Local
// storage today, per-device; once there are accounts this is where we'd
// branch to a backend-backed repository instead of changing call sites (see
// visitService.ts, preferencesService.ts for the same pattern).
function resolveRepository(): InstallRepository {
  return localStorageInstallRepository
}

export function hasInstalled(): boolean {
  return resolveRepository().hasInstalled()
}

export function markInstalled(): void {
  resolveRepository().markInstalled()
}

export function wasDismissed(): boolean {
  return resolveRepository().wasDismissed()
}

export function markDismissed(): void {
  resolveRepository().markDismissed()
}
