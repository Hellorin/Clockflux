import { useEffect, useRef } from 'react'

// Anything a browser will land on with Tab. :not([disabled]) matters because a
// disabled control still matches the tag selectors but is not tabbable, and
// including it would make the trap wrap to a stop the user can't see.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keeps Tab inside a dialog, and restores focus when it closes.
 *
 * Both modals already declared `role="dialog"`/`aria-modal="true"` and handled
 * Escape, but neither actually confined focus — so Tab walked straight out into
 * the page behind, which is still fully interactive. For a keyboard or screen
 * reader user that means the dialog is announced as modal and then simply isn't:
 * you tab out of it into content you can't see and can't get back from.
 * App.tsx's `inert={isLandingOpen}` shows the pattern was understood; it just
 * wasn't applied here.
 *
 * Returns the ref to attach to the dialog element.
 */
export function useFocusTrap<T extends HTMLElement>() {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Whatever had focus before the dialog opened, so it can be handed back —
    // otherwise closing drops focus to <body> and a keyboard user restarts
    // from the top of the page.
    const previouslyFocused = document.activeElement as HTMLElement | null

    function focusable(): HTMLElement[] {
      return Array.from(container!.querySelectorAll<HTMLElement>(FOCUSABLE))
    }

    // Queried on open rather than cached: the day editor adds and removes rows
    // while it's open, so a cached list goes stale immediately.
    focusable()[0]?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const elements = focusable()
      if (elements.length === 0) return

      const first = elements[0]
      const last = elements[elements.length - 1]
      const active = document.activeElement

      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (!container!.contains(active)) {
        // Focus escaped some other way (a click on the page behind, say).
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [])

  return containerRef
}
