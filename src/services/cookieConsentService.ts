import { localStorageCookieConsentRepository } from '../repositories/localStorageCookieConsentRepository'
import type { CookieConsentRepository } from '../repositories/types'
import type { CookieConsentChoice } from '../types'

// Single seam for choosing which store backs the cookie consent choice.
// Everyone is on local storage today; see resolveRepository() in
// preferencesService.ts for why this stays a function rather than a constant.
function resolveRepository(): CookieConsentRepository {
  return localStorageCookieConsentRepository
}

export function loadConsent(): CookieConsentChoice | null {
  return resolveRepository().loadConsent()
}

export function saveConsent(value: CookieConsentChoice): void {
  resolveRepository().saveConsent(value)
}
