import { useCallback, useState } from 'react'
import * as authService from '../services/authService'
import type { AuthUser } from '../types'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(authService.loadUser)

  const signIn = useCallback((credential: string) => {
    const decoded = authService.decodeGoogleCredential(credential)
    if (!decoded) return
    authService.saveUser(decoded)
    setUser(decoded)
  }, [])

  const signOut = useCallback(() => {
    authService.signOut()
    setUser(null)
  }, [])

  return { user, signIn, signOut }
}
