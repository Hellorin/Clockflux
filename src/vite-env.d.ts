/// <reference types="vite/client" />

interface Window {
  /**
   * Latched by the pre-hydration bootstrap in index.html when a visitor clicks
   * a landing-page dismiss control before React has mounted. Read once by
   * useLandingPage so the landing is not re-opened after hydration.
   */
  __timeforgeLandingDismissed?: boolean
}
