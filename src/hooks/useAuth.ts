import { useCallback, useState } from 'react'
import * as authService from '../services/authService'
import { getFeatures } from '../services/featuresService'
import type { AuthUser } from '../types'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(authService.loadUser)
  const [features, setFeatures] = useState<string[]>([])

  const signIn = useCallback(async (credential: string) => {
    const user = await authService.signInWithGoogle(credential)
    if (!user) return
    setUser(user)

    const accessToken = authService.loadAccessToken()
    if (!accessToken) return
    const featuresResponse = await getFeatures(accessToken)
    if (featuresResponse) setFeatures(featuresResponse.features)
  }, [])

  const signOut = useCallback(() => {
    authService.signOut()
    setUser(null)
    setFeatures([])
  }, [])

  return { user, features, signIn, signOut }
}
