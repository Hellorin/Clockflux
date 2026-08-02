import { localStorageVisitRepository } from '../repositories/localStorageVisitRepository'
import type { VisitRepository } from '../repositories/types'

// Single seam for choosing which store records that a visitor has been here
// before. Local storage today, which means the landing page reappears on a new
// device or after clearing site data; once there are accounts, this is where
// we'd branch to a backend-backed repository instead of changing call sites.
function resolveRepository(): VisitRepository {
  return localStorageVisitRepository
}

export function hasVisited(): boolean {
  return resolveRepository().hasVisited()
}

export function markVisited(): void {
  resolveRepository().markVisited()
}
