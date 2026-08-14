import { useCallback, useEffect, useState } from 'react'
import * as installService from '../services/installService'

// Not in lib.dom yet — this is the shape Chromium-based browsers actually
// dispatch. See https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

// True once the app is actually running installed (standalone window, no
// browser chrome) — covers installs the OS/browser did outside our own
// prompt (e.g. the browser's own menu, or iOS's manual "Add to Home
// Screen", which never fires beforeinstallprompt at all).
function isRunningStandalone(): boolean {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // Safari's iOS-only flag; not part of the standard Navigator type.
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export interface UseInstallPromptState {
  /** Whether the "Install Clockflux" banner should be shown right now. */
  canInstall: boolean
  /** Shows the browser's native install prompt; resolves once the user has answered it. */
  promptInstall: () => Promise<void>
  /** Hides the banner for future visits without installing. */
  dismiss: () => void
}

/**
 * Surfaces the browser's deferred `beforeinstallprompt` event as a
 * banner-friendly hook: capture the event, hold it until the user opts in,
 * then record the outcome in local storage (see installService) so the
 * banner doesn't keep reappearing once installed or dismissed.
 */
export function useInstallPrompt(): UseInstallPromptState {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(installService.wasDismissed)
  // Also true when the app is already running standalone, which covers
  // installs that happened outside our own prompt (browser menu, iOS manual
  // add-to-home-screen) so the banner never shows to someone who is already
  // running the installed app — computed up front rather than in an effect
  // so there's no extra render before the banner correctly stays hidden.
  const [installed, setInstalled] = useState(() => installService.hasInstalled() || isRunningStandalone())

  // Persists the standalone-detected install (see initializer above) so
  // hasInstalled() reflects it on future visits without needing the
  // display-mode check again.
  useEffect(() => {
    if (isRunningStandalone()) installService.markInstalled()
  }, [])

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      // Stops the browser's own mini-infobar so our banner is the only prompt.
      event.preventDefault()
      setDeferredEvent(event as BeforeInstallPromptEvent)
    }
    function handleAppInstalled() {
      installService.markInstalled()
      setInstalled(true)
      setDeferredEvent(null)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return
    await deferredEvent.prompt()
    const { outcome } = await deferredEvent.userChoice
    // The captured event is single-use regardless of outcome — the browser
    // only fires a fresh beforeinstallprompt for a later visit.
    setDeferredEvent(null)
    if (outcome === 'accepted') {
      // Also handled by the appinstalled listener above, but that can lag a
      // tick behind the user's choice — set it here too so the banner closes
      // immediately rather than flashing for one more render.
      installService.markInstalled()
      setInstalled(true)
    } else {
      installService.markDismissed()
      setDismissed(true)
    }
  }, [deferredEvent])

  const dismiss = useCallback(() => {
    installService.markDismissed()
    setDismissed(true)
  }, [])

  return {
    canInstall: deferredEvent !== null && !dismissed && !installed,
    promptInstall,
    dismiss,
  }
}
