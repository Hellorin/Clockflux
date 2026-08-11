import { useCallback, useEffect, useRef, useState } from 'react'
import * as authService from '../services/authService'
import { getFeaturesOrDefault, DEFAULT_FEATURES } from '../services/featuresService'
import type { Feature } from '../services/featuresService'
import type { AuthUser } from '../types'

// Comfortably under the backend's default ~15 minute access-token TTL, so a
// session survives as long as the tab stays open. If ACCESS_TOKEN_TTL is
// ever tuned much shorter than that on the backend, this should shrink too.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(authService.loadUser)
  const [features, setFeatures] = useState<Feature[]>(DEFAULT_FEATURES)
  // Reactive mirror of authService.loadAccessToken(), so consumers (e.g.
  // useAppSettings) can key their own effects off sign-in/sign-out rather
  // than re-reading storage on every render.
  const [accessToken, setAccessToken] = useState<string | null>(authService.loadAccessToken)
  // Set right after signIn() or the redirect-return handler below already
  // fetched a fresh token, so the heartbeat effect's own immediate refresh
  // (whose job is covering a *stale* token from localStorage) can skip that
  // redundant first round-trip and just start ticking.
  const skipNextHeartbeatRefreshRef = useRef(false)

  // Load the feature set as soon as the app mounts, using whatever access
  // token (if any) is already stored, so anonymous and returning-signed-in
  // users both get an accurate set without waiting for a sign-in action.
  useEffect(() => {
    const accessToken = authService.loadAccessToken()
    getFeaturesOrDefault(accessToken ?? undefined).then(setFeatures)
  }, [])

  const signIn = useCallback(async (credential: string) => {
    const user = await authService.signInWithGoogle(credential)
    if (!user) return
    skipNextHeartbeatRefreshRef.current = true
    setUser(user)

    const accessToken = authService.loadAccessToken()
    setAccessToken(accessToken)
    if (!accessToken) return
    const featuresResponse = await getFeaturesOrDefault(accessToken)
    setFeatures(featuresResponse)
  }, [])

  // Picks up a redirect-mode Google sign-in (see GoogleSignInButton's
  // login_uri): the backend finishes the exchange server-side and lands the
  // browser back here with ?auth=success/error rather than handing the
  // credential to any JS callback. All that's left to do is trade the
  // refresh-token cookie it just set for an access token — exactly what
  // refreshAccessToken() below already does — then strip the marker from the
  // URL so a later reload doesn't repeat this.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authResult = params.get('auth')
    if (!authResult) return

    params.delete('auth')
    const query = params.toString()
    const next = window.location.pathname + (query ? `?${query}` : '') + window.location.hash
    window.history.replaceState(null, '', next)

    if (authResult !== 'success') return
    authService.refreshAccessToken().then(refreshed => {
      if (!refreshed) return
      skipNextHeartbeatRefreshRef.current = true
      setUser(refreshed)
      const newAccessToken = authService.loadAccessToken()
      setAccessToken(newAccessToken)
      getFeaturesOrDefault(newAccessToken ?? undefined).then(setFeatures)
    })
  }, [])

  const signOut = useCallback(() => {
    authService.signOut()
    setUser(null)
    setAccessToken(null)
    getFeaturesOrDefault().then(setFeatures)
  }, [])

  // Keeps a signed-in session alive past the access token's short expiry:
  // refreshes once immediately (covers a tab reopened, or the page reloaded,
  // after the access token already expired while it was closed) and then on
  // a heartbeat for as long as the tab stays open and signed in. A failed
  // refresh means the refresh token itself is gone (expired, revoked, or
  // signed out elsewhere), so it signs out locally to match reality rather
  // than leaving a stale "signed in" state around with dead credentials.
  //
  // Depends on the boolean "is anyone signed in" rather than `user` itself,
  // so a successful refresh (which replaces `user` with a new object) does
  // not tear down and restart this effect — only an actual sign-in/sign-out
  // transition does.
  const isSignedIn = user !== null
  useEffect(() => {
    if (!isSignedIn) return
    let cancelled = false

    async function refresh() {
      const refreshed = await authService.refreshAccessToken()
      if (cancelled) return

      if (!refreshed) {
        authService.signOut()
        setUser(null)
        setAccessToken(null)
        getFeaturesOrDefault().then(f => {
          if (!cancelled) setFeatures(f)
        })
        return
      }

      setUser(refreshed)
      const newAccessToken = authService.loadAccessToken()
      setAccessToken(newAccessToken)
      getFeaturesOrDefault(newAccessToken ?? undefined).then(f => {
        if (!cancelled) setFeatures(f)
      })
    }

    if (skipNextHeartbeatRefreshRef.current) {
      skipNextHeartbeatRefreshRef.current = false
    } else {
      refresh()
    }
    const id = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [isSignedIn])

  return { user, features, accessToken, signIn, signOut }
}
