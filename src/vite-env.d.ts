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
  /**
   * Base URL of clockflux-account-front, the marketing/pricing +
   * checkout app — where the Settings page's "Upgrade to Pro" link sends a
   * Free user. Falls back to the production account site so nothing
   * breaks if it's left unset; override for local dev against an account
   * app running elsewhere.
   */
  readonly VITE_ACCOUNT_URL?: string
  /**
   * Base URL of clockflux-info-front — marketing/landing, docs, and the legal
   * documents (Terms, refund policy, privacy notice), which used to live in
   * this app's about/index.html. Read both by vite.config.js (via loadEnv, to
   * substitute %VITE_INFO_URL% in index.html's privacy link) and by App.tsx
   * (the header's "?" button).
   */
  readonly VITE_INFO_URL?: string
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
