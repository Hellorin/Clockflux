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
 * Cancels the signed-in user's Pro subscription at the end of the current
 * billing period (they keep Pro access until then). Returns whether the
 * request succeeded; the caller is responsible for updating the cached user
 * afterward, since the backend response has no body to read it from.
 */
export async function cancelSubscription(accessToken: string): Promise<boolean> {
  const result = await apiFetch({
    path: '/api/v1/billing/cancel-subscription',
    method: 'POST',
    accessToken,
    refreshToken: refreshForRetry,
  })
  return result.ok
}
