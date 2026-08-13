/**
 * Cancels the signed-in user's Pro subscription at the end of the current
 * billing period (they keep Pro access until then). Returns whether the
 * request succeeded; the caller is responsible for updating the cached user
 * afterward, since the backend response has no body to read it from.
 */
export async function cancelSubscription(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/billing/cancel-subscription`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    })
    return response.ok
  } catch {
    return false
  }
}
