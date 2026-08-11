import { localStorageAuthRepository } from '../repositories/localStorageAuthRepository'
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

export function loadUser(): AuthUser | null {
  return resolveRepository().loadUser()
}

export function saveUser(user: AuthUser): void {
  resolveRepository().saveUser(user)
}

export function loadAccessToken(): string | null {
  return resolveRepository().loadAccessToken()
}

export function signOut(): void {
  resolveRepository().clearUser()
  resolveRepository().clearAccessToken()
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
    saveUser(user)
    resolveRepository().saveAccessToken(accessToken)
    return user
  } catch {
    return null
  }
}
