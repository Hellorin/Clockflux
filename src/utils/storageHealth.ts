/**
 * A tiny observable flag for "the browser refused our last write to
 * localStorage".
 *
 * Guarding the repositories with try/catch stops a full storage quota or a
 * browser that blocks storage entirely (Safari with "Block All Cookies", some
 * embedded webviews) from crashing the app — but on its own it converts a
 * crash into something arguably worse: the user keeps checking in and out, sees
 * every session appear on screen, and loses all of it on reload with no
 * indication anything went wrong. For an app whose entire job is not losing
 * your hours, silence is the wrong failure mode.
 *
 * This lives in utils/ rather than services/ so the repositories — the lowest
 * layer — can report into it without depending upwards on a service.
 *
 * Deliberately not React state: the repositories are plain modules called from
 * inside state updaters, and useSyncExternalStore is exactly the bridge for
 * that.
 */

type Listener = () => void

let writesFailing = false
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) listener()
}

/** Records that a write to localStorage was rejected. */
export function reportStorageWriteFailed(): void {
  if (writesFailing) return
  writesFailing = true
  emit()
}

/**
 * Records that a write succeeded, clearing the warning.
 *
 * Worth calling on every success rather than only after a failure: a quota
 * error often clears once the user deletes something elsewhere on the origin,
 * and leaving a stale "not saved" banner up would train people to ignore it.
 */
export function reportStorageWriteSucceeded(): void {
  if (!writesFailing) return
  writesFailing = false
  emit()
}

/** Snapshot for useSyncExternalStore. Stable identity while nothing changes. */
export function isStorageWriteFailing(): boolean {
  return writesFailing
}

export function subscribeToStorageHealth(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test-only: drop all state so cases can't leak into one another. */
export function resetStorageHealth(): void {
  writesFailing = false
  listeners.clear()
}

/**
 * Runs a localStorage write, reporting the outcome and swallowing the error.
 * Returns whether the write actually landed.
 */
export function guardedWrite(write: () => void): boolean {
  try {
    write()
    reportStorageWriteSucceeded()
    return true
  } catch {
    reportStorageWriteFailed()
    return false
  }
}
