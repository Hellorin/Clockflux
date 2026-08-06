/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth Client ID (public, not a secret) used for Sign in with Google. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /**
   * Latched by the pre-hydration bootstrap in index.html when a visitor clicks
   * a landing-page dismiss control before React has mounted. Read once by
   * useLandingPage so the landing is not re-opened after hydration.
   */
  __clockfluxLandingDismissed?: boolean
}
