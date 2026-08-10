import type { CookieConsentChoice } from '../types'
import type { CookieConsentRepository } from './types'

// Exported so the privacy notice in index.html can be checked against the key
// actually in use — see src/test/indexHtml.test.ts.
export const STORAGE_KEY = 'cookieConsent'

function isChoice(value: string | null): value is CookieConsentChoice {
  return value === 'accepted' || value === 'refused'
}

export const localStorageCookieConsentRepository: CookieConsentRepository = {
  loadConsent(): CookieConsentChoice | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY)
      return isChoice(value) ? value : null
    } catch {
      return null
    }
  },
  saveConsent(value: CookieConsentChoice): void {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Storage unavailable (e.g. Safari private mode). The banner reappears
      // on the next visit, which is a fine degradation.
    }
  },
}
