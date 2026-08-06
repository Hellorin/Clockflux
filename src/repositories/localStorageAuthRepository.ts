import type { AuthUser } from '../types'
import type { AuthRepository } from './types'

const STORAGE_KEY = 'timeforgeUser'

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
}
