import { useEffect, useRef } from 'react'
import type { AuthUser } from '../types'

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const GIS_SCRIPT_ID = 'google-identity-services'

interface GoogleCredentialResponse {
  credential: string
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string
    callback?: (response: GoogleCredentialResponse) => void
    // Redirect mode: instead of a popup window handing the credential back to
    // this callback, Google POSTs it straight to login_uri as a form (no
    // frontend JS involved) and that endpoint redirects back into the app —
    // the same full-page navigation on desktop that GIS already falls back
    // to on mobile. See AuthHandler.GoogleRedirectCallback on the backend.
    ux_mode?: 'popup' | 'redirect'
    login_uri?: string
  }): void
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

function loadGisScript(onReady: () => void) {
  const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null
  if (existing) {
    if (window.google?.accounts?.id) onReady()
    else existing.addEventListener('load', onReady, { once: true })
    return
  }
  const script = document.createElement('script')
  script.id = GIS_SCRIPT_ID
  script.src = GIS_SCRIPT_SRC
  script.async = true
  script.defer = true
  script.addEventListener('load', onReady, { once: true })
  document.head.appendChild(script)
}

interface GoogleSignInButtonProps {
  user: AuthUser | null
  onSignIn: (credential: string) => void
  onSignOut: () => void
}

export default function GoogleSignInButton({ user, onSignIn, onSignOut }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (user || !clientId || !buttonRef.current) return
    const container = buttonRef.current
    loadGisScript(() => {
      const accountsId = window.google?.accounts?.id
      if (!accountsId || !container.isConnected) return
      // Strict Mode runs effects twice in dev; clear out any button rendered
      // by a prior run so this container never ends up with two stacked on
      // top of each other.
      container.innerHTML = ''
      accountsId.initialize({
        client_id: clientId,
        // Kept as a harmless fallback — GIS ignores this in redirect mode,
        // but if it were ever invoked, wiring it through is still correct.
        callback: response => onSignIn(response.credential),
        ux_mode: 'redirect',
        // This is the plain, unparameterized callback path — this app is
        // the backend's DefaultFrontendKey ("app"), so it needs no
        // "/{frontend}" suffix (see clockflux-account-front's
        // GoogleSignInButton.tsx for the multi-frontend variant, and
        // AuthHandler.GoogleRedirectCallback for why it's a path segment and
        // not a query param or GIS config field: login_uri must exactly
        // match an Authorized redirect URI registered with Google, and a
        // query string breaks that match).
        login_uri: `${import.meta.env.VITE_API_URL}/api/v1/auth/google/callback`,
      })
      accountsId.renderButton(container, { type: 'icon', theme: 'outline', size: 'medium', shape: 'circle' })
    })
  }, [user, clientId, onSignIn])

  if (!clientId) return null

  if (user) {
    return (
      <button
        type="button"
        className="app-auth-signout"
        onClick={onSignOut}
        aria-label={`Signed in as ${user.email} — sign out`}
        title={`Signed in as ${user.email} — click to sign out`}
      >
        <span aria-hidden="true">🚪</span> Sign out
      </button>
    )
  }

  return <div ref={buttonRef} className="app-auth-btn" />
}
