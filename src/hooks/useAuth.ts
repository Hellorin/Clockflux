import { useCallback, useEffect, useRef, useState } from 'react'
import * as authService from '../services/authService'
import { getFeaturesOrDefault, DEFAULT_FEATURES } from '../services/featuresService'
import type { Feature } from '../services/featuresService'
import type { AuthUser } from '../types'

// Comfortably under the backend's default ~15 minute access-token TTL, so a
// session survives as long as the tab stays open. If ACCESS_TOKEN_TTL is
// ever tuned much shorter than that on the backend, this should shrink too.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000

// Backoff for a refresh that failed for a reason other than the session being
// over — offline, a timeout, a backend blip. Starts well inside the token's
// remaining life so a brief outage costs nothing, and caps below the heartbeat
// interval so the two never drift far apart.
const RETRY_BASE_MS = 15 * 1000
const RETRY_MAX_MS = 5 * 60 * 1000

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
  // Drives the backoff below, reset on every successful refresh.
  const consecutiveFailuresRef = useRef(0)
  const retryTimerRef = useRef<number | undefined>(undefined)

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

  // Optimistically patches the cached user (e.g. right after a successful
  // subscription cancellation), ahead of the next heartbeat refresh
  // confirming it from the backend.
  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser(authService.updateUser(patch))
  }, [])

  // safeToWipe: whether the caller has confirmed local Pro data is fully
  // reflected on the server (e.g. a successful final flush) — see
  // authService.signOut(). Defaults to false: an unconfirmed sign-out should
  // never risk wiping data that might not have made it to the cloud yet.
  const signOut = useCallback((safeToWipe: boolean = false) => {
    Promise.resolve(authService.signOut(safeToWipe)).then(() => {
      getFeaturesOrDefault().then(setFeatures)
    })
    setUser(null)
    setAccessToken(null)
  }, [])

  // Keeps a signed-in session alive past the access token's short expiry:
  // refreshes once immediately (covers a tab reopened, or the page reloaded,
  // after the access token already expired while it was closed) and then on
  // a heartbeat for as long as the tab stays open and signed in.
  //
  // A 401 means the refresh token itself is gone (expired, revoked, or signed
  // out elsewhere), so it signs out locally to match reality rather than
  // leaving a stale "signed in" state with dead credentials. Any *other*
  // failure — offline, timeout, backend blip — leaves the session alone and
  // retries with backoff, because it says nothing about whether the session is
  // still valid.
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
      const result = await authService.refreshSession()
      if (cancelled) return

      if (!result.ok) {
        // Only a 401 means the refresh token is actually spent (expired,
        // revoked, or signed out elsewhere). This used to sign the user out on
        // *any* failure, because refreshAccessToken collapsed everything to
        // null — so one dropped request on a train ended a perfectly valid
        // session and, for a Pro user, took their sync with it.
        if (result.error !== 'auth') {
          scheduleRetry()
          return
        }

        // The session really is over. That's not evidence the cloud copy is
        // current, so never wipe local Pro data here.
        authService.signOut(false)
        setUser(null)
        setAccessToken(null)
        getFeaturesOrDefault().then(f => {
          if (!cancelled) setFeatures(f)
        })
        return
      }

      consecutiveFailuresRef.current = 0
      setUser(result.user)
      const newAccessToken = authService.loadAccessToken()
      setAccessToken(newAccessToken)
      getFeaturesOrDefault(newAccessToken ?? undefined).then(f => {
        if (!cancelled) setFeatures(f)
      })
    }

    // Retries sooner than the next heartbeat, backing off so a sustained
    // outage doesn't turn into a request every few seconds. The session is
    // left intact throughout: the access token may lapse in the meantime, but
    // apiClient recovers that on the next 401 as soon as the network is back.
    function scheduleRetry() {
      const attempt = ++consecutiveFailuresRef.current
      const delay = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS)
      retryTimerRef.current = window.setTimeout(() => {
        if (!cancelled) refresh()
      }, delay)
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
      // The backoff timer outlives the interval, so it needs clearing too or a
      // sign-out leaves a pending retry that fires against a dead session.
      if (retryTimerRef.current !== undefined) clearTimeout(retryTimerRef.current)
    }
  }, [isSignedIn])

  // Surfaces "signed in on this device before" even while signed out, so the
  // UI can explain a missing Pro badge (session expired / signed out
  // elsewhere) rather than have it silently look like a plan downgrade.
  const previouslySignedIn = !user && authService.hasSignedInBefore()

  return { user, features, accessToken, signIn, signOut, updateUser, previouslySignedIn }
}
