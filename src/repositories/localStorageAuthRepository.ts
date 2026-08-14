import { isAuthUser, type AuthUser } from '../types'
import type { AuthRepository } from './types'

// Exported so the privacy notice's drift guard (src/test/indexHtml.test.ts)
// can assert these are actually disclosed, rather than the notice quietly
// describing a subset of what the app writes.
export const STORAGE_KEY = 'appUser'
export const ACCESS_TOKEN_STORAGE_KEY = 'appAccessToken'
export const HAS_SIGNED_IN_BEFORE_KEY = 'appHasSignedInBefore'

export const localStorageAuthRepository: AuthRepository = {
  loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      // Validated rather than cast: this value drives plan-based routing and
      // feature flags, and it comes from storage anything on the origin can
      // write. Treat a malformed entry as "not signed in" — the backend is
      // authoritative on entitlements anyway, so the worst case is one extra
      // sign-in rather than a broken render.
      const parsed: unknown = JSON.parse(raw)
      return isAuthUser(parsed) ? parsed : null
    } catch {
      return null
    }
  },
  saveUser(user: AuthUser): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } catch {
      // Storage unavailable (e.g. Safari private mode). Sign-in still works
      // for the current session, it just won't survive a reload.
    }
  },
  clearUser(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to do if storage is unavailable.
    }
  },
  loadAccessToken(): string | null {
    try {
      return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
    } catch {
      return null
    }
  },
  saveAccessToken(accessToken: string): void {
    try {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken)
    } catch {
      // Storage unavailable (e.g. Safari private mode). Sign-in still works
      // for the current session, it just won't survive a reload.
    }
  },
  clearAccessToken(): void {
    try {
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
    } catch {
      // Nothing to do if storage is unavailable.
    }
  },
  hasSignedInBefore(): boolean {
    try {
      return localStorage.getItem(HAS_SIGNED_IN_BEFORE_KEY) === 'true'
    } catch {
      return false
    }
  },
  markSignedInBefore(): void {
    try {
      localStorage.setItem(HAS_SIGNED_IN_BEFORE_KEY, 'true')
    } catch {
      // Nothing to do if storage is unavailable.
    }
  },
}
