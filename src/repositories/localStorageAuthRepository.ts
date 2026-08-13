import type { AuthUser } from '../types'
import type { AuthRepository } from './types'

const STORAGE_KEY = 'appUser'
const ACCESS_TOKEN_STORAGE_KEY = 'appAccessToken'
const HAS_SIGNED_IN_BEFORE_KEY = 'appHasSignedInBefore'

export const localStorageAuthRepository: AuthRepository = {
  loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as AuthUser) : null
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
