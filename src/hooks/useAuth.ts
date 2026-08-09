import { useCallback, useEffect, useState } from 'react'
import * as authService from '../services/authService'
import { getFeaturesOrDefault, DEFAULT_FEATURES } from '../services/featuresService'
import type { Feature } from '../services/featuresService'
import type { AuthUser } from '../types'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(authService.loadUser)
  const [features, setFeatures] = useState<Feature[]>(DEFAULT_FEATURES)

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
    setUser(user)

    const accessToken = authService.loadAccessToken()
    if (!accessToken) return
    const featuresResponse = await getFeaturesOrDefault(accessToken)
    setFeatures(featuresResponse)
  }, [])

  const signOut = useCallback(() => {
    authService.signOut()
    setUser(null)
    getFeaturesOrDefault().then(setFeatures)
  }, [])

  return { user, features, signIn, signOut }
}
