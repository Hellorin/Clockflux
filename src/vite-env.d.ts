/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth Client ID (public, not a secret) used for Sign in with Google. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** Base URL of the Timeforge API, e.g. http://localhost:8080. */
  readonly VITE_API_URL?: string
  /**
   * Feature flag gating "Sign in with Google" and everything behind it
   * (feature-flag fetching, etc). The backend auth flow isn't production-ready
   * yet, so this defaults to off; set to 'true' to enable it locally.
   */
  readonly VITE_ENABLE_AUTH?: string
  /**
   * Master switch for paid-only features. Off by default until paid features
   * actually ship. Login is only shown when this and VITE_ENABLE_AUTH are
   * both 'true', since signing in exists solely to unlock paid features.
   */
  readonly VITE_ENABLE_PAID_FEATURES?: string
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
