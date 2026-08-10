import { useCallback, useState } from 'react'
import * as cookieConsentService from '../services/cookieConsentService'
import type { CookieConsentChoice } from '../types'

export interface CookieConsentState {
  /** null until the visitor has made a choice — that's what shows the banner. */
  consent: CookieConsentChoice | null
  accept: () => void
  refuse: () => void
}

export function useCookieConsent(): CookieConsentState {
  const [consent, setConsent] = useState<CookieConsentChoice | null>(cookieConsentService.loadConsent)

  const accept = useCallback(() => {
    cookieConsentService.saveConsent('accepted')
    setConsent('accepted')
  }, [])

  const refuse = useCallback(() => {
    cookieConsentService.saveConsent('refused')
    setConsent('refused')
  }, [])

  return { consent, accept, refuse }
}
