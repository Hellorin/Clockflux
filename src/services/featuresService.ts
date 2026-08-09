export interface FeaturesResponse {
  authenticated: boolean
  features: string[]
}

export interface Feature {
  key: string
  authenticated: boolean
}

// Used when the /api/v1/features call fails (offline, backend down, CORS
// misconfigured, etc.) so the app still has a sane feature set to work with.
export const DEFAULT_FEATURES: Feature[] = [
  { key: 'tracker', authenticated: false },
  { key: 'calendar', authenticated: false },
  { key: 'holiday', authenticated: false },
  { key: 'health', authenticated: false },
]

function isFeaturesResponse(value: unknown): value is FeaturesResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<FeaturesResponse>
  return typeof candidate.authenticated === 'boolean' && Array.isArray(candidate.features)
}

/**
 * Fetches the caller's enabled feature flags from /api/v1/features. Pass an
 * accessToken to get the authenticated-only feature set; omit it to fetch
 * the anonymous set.
 */
export async function getFeatures(accessToken?: string): Promise<FeaturesResponse | null> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/features`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
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

/**
 * Fetches the caller's feature flags, falling back to DEFAULT_FEATURES if
 * the request fails for any reason (offline, backend down, CORS
 * misconfigured, etc.).
 */
export async function getFeaturesOrDefault(accessToken?: string): Promise<Feature[]> {
  const response = await getFeatures(accessToken)
  if (!response) return DEFAULT_FEATURES
  return response.features.map(key => ({ key, authenticated: response.authenticated }))
}
