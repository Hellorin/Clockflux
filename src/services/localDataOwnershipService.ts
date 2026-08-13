import { localStorageOwnershipRepository } from '../repositories/localStorageOwnershipRepository'
import { DEFAULT_SETTINGS } from '../hooks/useAppSettings'
import type { OwnershipRepository } from '../repositories/types'
import type { Settings, TimeEntriesData } from '../types'

// Single seam for choosing which store backs ownership tracking. Local
// storage today; see resolveRepository() in the other services for the same
// pattern once there's a backend-backed alternative.
function resolveRepository(): OwnershipRepository {
  return localStorageOwnershipRepository
}

export type OwnedData = TimeEntriesData & { settings: Settings }

export interface ReconcileResult {
  // Data the caller should adopt as the new active local state. Null means
  // "no change" — either the owner didn't change, or this is the first time
  // the local data has ever been claimed, in which case what's already on
  // screen is exactly right and should just get tagged, not replaced.
  data: OwnedData | null
}

/**
 * Call this whenever the app learns which account is now signed in (a fresh
 * sign-in, or a token refresh confirming an existing session), before any
 * sync/settings-push logic gets a chance to run. Local storage has no
 * built-in owner, so without this check a second, different account signing
 * in on the same browser would silently inherit — and then overwrite — the
 * first account's data (see useSync.ts's push-from-null-baseline behavior).
 *
 * - No owner tag yet: local data is unclaimed (anonymous/free use, or data
 *   from before this existed). Claim it for `ownerId` and change nothing —
 *   this is what lets a free user's history upload normally on their first
 *   sign-in/upgrade.
 * - Owner tag matches `ownerId`: same person returning. No-op.
 * - Owner tag is someone else: back up the current local data under the old
 *   owner's id (never discard it — it may be their only copy), then either
 *   restore `ownerId`'s own backup from a previous visit, or reset to empty
 *   defaults if this is `ownerId`'s first time on this device.
 */
export function reconcileOwner(ownerId: string, current: OwnedData): ReconcileResult {
  const repository = resolveRepository()
  const previousOwnerId = repository.loadOwnerId()

  if (previousOwnerId === null) {
    repository.saveOwnerId(ownerId)
    return { data: null }
  }

  if (previousOwnerId === ownerId) {
    return { data: null }
  }

  repository.saveBackup(previousOwnerId, current)
  repository.saveOwnerId(ownerId)

  const restored = repository.loadBackup(ownerId)
  if (restored) {
    repository.clearBackup(ownerId)
    return { data: restored }
  }

  return { data: { days: {}, daysOff: {}, settings: DEFAULT_SETTINGS } }
}
