import { useSyncExternalStore } from 'react'
import { isStorageWriteFailing, subscribeToStorageHealth } from '../utils/storageHealth'

/**
 * True while the browser is rejecting writes to localStorage.
 *
 * The repositories now swallow those errors so a full quota or a
 * storage-blocking privacy setting can't crash the app mid-render. That fix
 * alone, though, would leave the user checking in and out, watching every
 * session appear on screen, and losing the lot on reload without ever being
 * told. This is what turns that silence back into a visible warning.
 *
 * useSyncExternalStore rather than useState + useEffect because the writes are
 * reported from plain modules called inside React state updaters, not from
 * anything that could hold React state of its own.
 */
export function useStorageHealth(): boolean {
  return useSyncExternalStore(subscribeToStorageHealth, isStorageWriteFailing, isStorageWriteFailing)
}
