import { localStorageAuthRepository } from '../repositories/localStorageAuthRepository'
import { STORAGE_KEY as TIME_ENTRIES_STORAGE_KEY } from '../repositories/localStorageTimeEntriesRepository'
import { STORAGE_KEY as SETTINGS_STORAGE_KEY } from '../repositories/localStorageSettingsRepository'
import type { AuthRepository } from '../repositories/types'
import type { AuthUser } from '../types'

// Single seam for choosing which store backs the signed-in user. Local
// storage today; once there's a backend this is where we'd branch to a
// server-backed repository instead of changing every call site below.
function resolveRepository(): AuthRepository {
  return localStorageAuthRepository
}

interface AuthResponse {
  user: AuthUser
  accessToken: string
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AuthUser>
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.picture === 'string' &&
    (candidate.plan === 'free' || candidate.plan === 'pro')
  )
}

// Normalizes cancelAtPeriodEnd to a boolean, since it's a newer field the
// backend always sends but a user cached in localStorage before this field
// existed won't have.
function normalizeAuthUser(user: AuthUser): AuthUser {
  return { ...user, cancelAtPeriodEnd: user.cancelAtPeriodEnd === true }
}

export function loadUser(): AuthUser | null {
  const user = resolveRepository().loadUser()
  return user ? normalizeAuthUser(user) : null
}

export function saveUser(user: AuthUser): void {
  resolveRepository().saveUser(user)
  // Deliberately never cleared by signOut(): this is what lets the app
  // recognize "signed in on this device before" even after the session
  // itself has expired or been signed out of, so it can explain a missing
  // Pro badge instead of silently looking like a downgrade.
  resolveRepository().markSignedInBefore()
}

/**
 * True if this device has ever completed a sign-in, regardless of whether
 * the current session is still valid. Used to tell "never signed in" apart
 * from "signed in before, just not connected right now" when `loadUser()`
 * is null.
 */
export function hasSignedInBefore(): boolean {
  return resolveRepository().hasSignedInBefore()
}

/**
 * Merges patch into the currently cached user and persists it — used for
 * optimistic local updates (e.g. right after cancelling a subscription)
 * ahead of the next token refresh confirming it from the backend. No-op if
 * no user is currently signed in.
 */
export function updateUser(patch: Partial<AuthUser>): AuthUser | null {
  const current = loadUser()
  if (!current) return null
  const updated = { ...current, ...patch }
  saveUser(updated)
  return updated
}

export function loadAccessToken(): string | null {
  return resolveRepository().loadAccessToken()
}

/**
 * Ends the session both locally and on the server: deletes the stored
 * refresh token and clears its HttpOnly cookie via /api/v1/auth/logout,
 * then clears the cached user/access token. Local state is cleared
 * regardless of whether the network call succeeds, so a flaky connection
 * can't strand the user in a "still signed in" state.
 *
 * The time-entry and settings data is only cleared if the signing-out user
 * was on the Pro plan *and* the caller confirms (via `safeToWipe`) that the
 * local copy is fully reflected on the server. For a free user, localStorage
 * is the *only* copy of their data — there's no cloud backup (see
 * useSync.ts, Pro-only) — so wiping it on every sign-out would be a
 * straight-up data loss bug: sign out, sign back in, history gone. For a Pro
 * user the cloud snapshot is normally authoritative, so it's safe to drop
 * the local copy — and doing so is what stops a shared/borrowed device
 * handing the next signed-in user the previous Pro account's work history,
 * or worse, syncing it into their cloud snapshot (see useSync.ts's
 * push-on-change) — but only once the caller has verified nothing local is
 * still unsynced (e.g. an offline edit whose push never landed). When in
 * doubt (`safeToWipe: false`), local data is left alone even for a Pro user,
 * matching the free-user fallback: an unsynced local copy beats no copy.
 *
 * `safeToWipe` defaults to true for callers that have no way to check (e.g.
 * an automatic sign-out triggered by a dead refresh token) should instead
 * pass `false` explicitly — see useAuth.ts.
 */
export async function signOut(safeToWipe: boolean = true): Promise<void> {
  const wasPro = loadUser()?.plan === 'pro'

  try {
    await fetch(`${import.meta.env.VITE_API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // Best-effort — local state is cleared below regardless.
  }
  resolveRepository().clearUser()
  resolveRepository().clearAccessToken()
  if (wasPro && safeToWipe) {
    localStorage.removeItem(TIME_ENTRIES_STORAGE_KEY)
    localStorage.removeItem(SETTINGS_STORAGE_KEY)
  }
}

/**
 * Hands the Google Identity Services credential (ID token) to the backend for
 * verification at /api/v1/auth/google. The backend verifies the token's
 * signature against Google and establishes a session (HttpOnly cookie), so
 * the resulting AuthUser it returns is the source of truth — never decoded
 * or trusted client-side. The response also carries an accessToken for
 * attaching to subsequent API calls.
 */
export async function signInWithGoogle(credential: string): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential }),
    })
    if (!response.ok) return null
    const { user, accessToken } = (await response.json()) as Partial<AuthResponse>
    if (!isAuthUser(user) || typeof accessToken !== 'string') return null
    const normalized = normalizeAuthUser(user)
    saveUser(normalized)
    resolveRepository().saveAccessToken(accessToken)
    return normalized
  } catch {
    return null
  }
}

/**
 * Exchanges the httpOnly refresh-token cookie (set by signInWithGoogle or a
 * prior call to this) for a new access token at /api/v1/auth/refresh, so a
 * session can outlive the short-lived (~15 minute) access token without
 * asking the user to sign in again. The refresh token itself is never
 * visible to JS — the browser attaches it automatically via
 * credentials: 'include'. Returns null if there's no valid refresh token
 * (expired, revoked, or never signed in) or the request fails for any other
 * reason; callers should treat null as "no longer signed in".
 */
export async function refreshAccessToken(): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok) return null
    const { user, accessToken } = (await response.json()) as Partial<AuthResponse>
    if (!isAuthUser(user) || typeof accessToken !== 'string') return null
    const normalized = normalizeAuthUser(user)
    saveUser(normalized)
    resolveRepository().saveAccessToken(accessToken)
    return normalized
  } catch {
    return null
  }
}
