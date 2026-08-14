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
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    })
    return response.ok
  } catch {
    return false
  }
}
