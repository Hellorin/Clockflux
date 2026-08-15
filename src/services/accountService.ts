import { apiFetch } from './apiClient'
import { refreshAccessToken, loadAccessToken } from './authService'

/**
 * Obtains a fresh access token after a 401, reusing authService's single-flight
 * refresh — refresh tokens are single-use and a second concurrent redemption is
 * treated server-side as theft, so this must not start its own request.
 */
async function refreshForRetry(): Promise<string | null> {
  const user = await refreshAccessToken()
  return user ? loadAccessToken() : null
}

/**
 * Permanently deletes the signed-in user's account: the backend cancels any
 * active subscription, then erases their profile, cloud snapshot, settings
 * and every session.
 *
 * Returns whether the deletion succeeded. Unlike the other API calls in this
 * app, a failure here must not be swallowed — telling someone their account
 * is gone when it isn't is far worse than showing an error, so the caller is
 * expected to surface a false result rather than proceed.
 */
export async function deleteAccount(accessToken: string): Promise<boolean> {
  const result = await apiFetch({
    path: '/api/v1/account',
    method: 'DELETE',
    accessToken,
    refreshToken: refreshForRetry,
  })
  return result.ok
}
