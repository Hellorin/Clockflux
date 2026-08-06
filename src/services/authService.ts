import { localStorageAuthRepository } from '../repositories/localStorageAuthRepository'
import type { AuthRepository } from '../repositories/types'
import type { AuthUser } from '../types'

// Single seam for choosing which store backs the signed-in user. Local
// storage today; once there's a backend this is where we'd branch to a
// server-backed repository instead of changing every call site below.
function resolveRepository(): AuthRepository {
  return localStorageAuthRepository
}

export function loadUser(): AuthUser | null {
  return resolveRepository().loadUser()
}

export function saveUser(user: AuthUser): void {
  resolveRepository().saveUser(user)
}

export function signOut(): void {
  resolveRepository().clearUser()
}

/**
 * Decodes the profile fields out of a Google Identity Services ID token
 * (a JWT) without verifying its signature. There is no backend to verify
 * against, and the token is only ever used to display a name/avatar — never
 * to authorize anything — so a client-side decode is sufficient here.
 */
export function decodeGoogleCredential(credential: string): AuthUser | null {
  const payload = credential.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    const claims = JSON.parse(json)
    if (typeof claims.email !== 'string') return null
    return {
      name: typeof claims.name === 'string' ? claims.name : claims.email,
      email: claims.email,
      picture: typeof claims.picture === 'string' ? claims.picture : '',
    }
  } catch {
    return null
  }
}
