import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import * as visitService from '../services/visitService'

// The landing page markup is static, in index.html, so that crawlers see the
// copy without executing any JavaScript. React never renders it — it only owns
// visibility, through these three tokens. src/test/indexHtml.test.ts asserts
// the markup still provides them.
const LANDING_ELEMENT_ID = 'landing'
const DISMISS_SELECTOR = '[data-landing-dismiss]'
const HIDDEN = 'hidden'
const VISIBLE = 'visible'

export interface UseLandingPageOptions {
  /** Focused when the landing closes and nothing was focused before it opened. */
  returnFocusRef?: RefObject<HTMLElement | null>
}

export interface LandingPageState {
  isLandingOpen: boolean
  openLanding: () => void
  closeLanding: () => void
}

function getLandingElement(): HTMLElement | null {
  return document.getElementById(LANDING_ELEMENT_ID)
}

function readInitialOpen(): boolean {
  // No landing markup at all — component tests render <App /> into a bare
  // document, and the hook stays inert there.
  if (!getLandingElement()) return false
  if (window.__timeforgeLandingDismissed) return false
  // Honour the decision the pre-paint script in index.html already made, so we
  // never re-open something that has already been hidden without a flash...
  if (document.documentElement.dataset.landing === HIDDEN) return false
  // ...but fall back to storage rather than trusting that script ran at all: a
  // content policy that blocks inline scripts would otherwise show the landing
  // to a returning visitor on every load.
  return !visitService.hasVisited()
}

export function useLandingPage(options: UseLandingPageOptions = {}): LandingPageState {
  const { returnFocusRef } = options
  const [isLandingOpen, setIsLandingOpen] = useState(readInitialOpen)
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  const hasSyncedRef = useRef(false)

  const openLanding = useCallback(() => setIsLandingOpen(true), [])
  const closeLanding = useCallback(() => setIsLandingOpen(false), [])

  // The visit has happened by the time we mount, whether or not the landing was
  // shown. Recording it here rather than on dismissal keeps openLanding free of
  // storage writes, so re-opening from the header never resets the flag.
  useEffect(() => {
    visitService.markVisited()
  }, [])

  // A dismiss click can land after paint but before this commit; index.html
  // latches it so we don't re-open what the visitor already closed. The
  // initializer above reads the same latch, so this only covers the sliver
  // between that read and mount — which is precisely the "subscribe to an
  // external system" case the rule below is not aimed at.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.__timeforgeLandingDismissed) setIsLandingOpen(false)
  }, [])

  useEffect(() => {
    const landingEl = getLandingElement()
    if (!landingEl) return

    document.documentElement.dataset.landing = isLandingOpen ? VISIBLE : HIDDEN

    const isInitialRun = !hasSyncedRef.current
    hasSyncedRef.current = true

    if (isLandingOpen) {
      if (!isInitialRun) {
        const active = document.activeElement
        lastFocusedRef.current =
          active instanceof HTMLElement && active !== document.body ? active : null
      }
      landingEl.focus()
    } else if (!isInitialRun) {
      // Never leave focus on the element we just hid.
      const target = lastFocusedRef.current ?? returnFocusRef?.current ?? null
      lastFocusedRef.current = null
      target?.focus()
    }
  }, [isLandingOpen, returnFocusRef])

  // How React finds out about clicks on the static dismiss controls. Capturing,
  // and idempotent with the inline bootstrap handler, so the two need no
  // coordination.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target
      if (target instanceof Element && target.closest(DISMISS_SELECTOR)) {
        closeLanding()
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [closeLanding])

  useEffect(() => {
    if (!isLandingOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeLanding()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isLandingOpen, closeLanding])

  return { isLandingOpen, openLanding, closeLanding }
}
