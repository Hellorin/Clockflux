export interface FeaturesResponse {
  authenticated: boolean
  features: string[]
}

function isFeaturesResponse(value: unknown): value is FeaturesResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<FeaturesResponse>
  return typeof candidate.authenticated === 'boolean' && Array.isArray(candidate.features)
}

/**
 * Fetches the caller's enabled feature flags from /api/v1/features, authenticated
 * via the accessToken obtained at sign-in.
 */
export async function getFeatures(accessToken: string): Promise<FeaturesResponse | null> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/features`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    })
    if (!response.ok) return null
    const data = await response.json()
    if (!isFeaturesResponse(data)) return null
    return data
  } catch {
    return null
  }
}
