import { localStorageAuthRepository } from '../repositories/localStorageAuthRepository'
import { STORAGE_KEY as TIME_ENTRIES_STORAGE_KEY } from '../repositories/localStorageTimeEntriesRepository'
import { STORAGE_KEY as SETTINGS_STORAGE_KEY } from '../repositories/localStorageSettingsRepository'
import type { AuthRepository } from '../repositories/types'
import { isAuthUser, type AuthUser } from '../types'
import { apiFetch, type ApiError } from './apiClient'

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

function isAuthResponse(value: unknown): value is AuthResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AuthResponse>
  return isAuthUser(candidate.user) && typeof candidate.accessToken === 'string'
}

// Normalizes cancelAtPeriodEnd to a boolean, since it's a newer field the
// backend always sends but a user cached in localStorage before this field
// existed won't have.
function normalizeAuthUser(user: AuthUser): AuthUser {
  return {
    ...user,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd === true,
    // isAuthUser accepts an absent picture — a Google account with no profile
    // photo genuinely has none — so give downstream a string rather than
    // making every consumer null-check a field the type says is required.
    picture: user.picture ?? '',
  }
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

// Refresh tokens are single-use and rotate on every redemption (see the
// backend's RefreshTokenRepository.Redeem): a second, concurrent redemption
// of the *same* token is indistinguishable server-side from theft, and gets
// treated as such — it revokes the entire token family, tearing down the
// session that the first (winning) redemption just renewed. Two callers
// firing refreshAccessToken() at nearly the same moment (e.g. React
// StrictMode double-invoking the mount effect in useAuth, or two effects
// both wanting a fresh token right after a redirect) would otherwise produce
// exactly that race and sign the user out. Sharing one in-flight request
// across all concurrent callers makes that impossible: there's only ever one
// redemption in flight, so there's nothing to race.
let inFlightRefresh: Promise<RefreshResult> | null = null

/**
 * Exchanges the httpOnly refresh-token cookie (set by signInWithGoogle or a
 * prior call to this) for a new access token at /api/v1/auth/refresh, so a
 * session can outlive the short-lived (~15 minute) access token without
 * asking the user to sign in again. The refresh token itself is never
 * visible to JS — the browser attaches it automatically via
 * credentials: 'include'. Returns null if there's no valid refresh token
 * (expired, revoked, or never signed in) or the request fails for any other
 * reason; callers should treat null as "no longer signed in".
 *
 * Concurrent calls share a single in-flight request rather than each firing
 * their own — see inFlightRefresh above.
 */
export function refreshAccessToken(): Promise<AuthUser | null> {
  return refreshSession().then(result => (result.ok ? result.user : null))
}

/**
 * Why a refresh failed, which callers genuinely need to tell apart.
 *
 * refreshAccessToken returns null for every failure, and useAuth's heartbeat
 * read that as "the refresh token is gone" and signed the user out. But a
 * network blip, a timeout, or a backend 500 produce exactly the same null — so
 * one flaky moment on mobile ended a perfectly valid session. Only 'auth'
 * actually means the session is over.
 */
export type RefreshResult =
  | { ok: true; user: AuthUser }
  | { ok: false; error: ApiError }

/**
 * The refresh, reporting why it failed.
 *
 * Shares the same single in-flight promise as refreshAccessToken — that is not
 * an optimization. Refresh tokens are single-use and rotate on redemption, and
 * the backend treats a second concurrent redemption of the same token as theft,
 * revoking the entire family and tearing down the session the first redemption
 * had just renewed.
 */
export function refreshSession(): Promise<RefreshResult> {
  if (inFlightRefresh) return inFlightRefresh

  inFlightRefresh = (async (): Promise<RefreshResult> => {
    try {
      // No refreshToken callback here, for obvious reasons: this *is* the
      // refresh, and a 401 means the refresh token itself is spent.
      const result = await apiFetch({ path: '/api/v1/auth/refresh', method: 'POST' }, isAuthResponse)
      if (!result.ok) return { ok: false, error: result.error }

      const normalized = normalizeAuthUser(result.value.user)
      saveUser(normalized)
      resolveRepository().saveAccessToken(result.value.accessToken)
      return { ok: true, user: normalized }
    } finally {
      inFlightRefresh = null
    }
  })()

  return inFlightRefresh
}
