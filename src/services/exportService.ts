import { apiFetchRaw } from './apiClient'

/** Export generation is server-side and can be slow for a multi-year PDF. */
const EXPORT_TIMEOUT_MS = 60000
import { refreshAccessToken, loadAccessToken } from './authService'
import type { DaysMap, DaysOffMap } from '../types'

export type ExportFormat = 'csv' | 'pdf' | 'ics'

export interface ExportParams {
  format: ExportFormat
  startDate: string
  endDate: string
  days: DaysMap
  daysOff: DaysOffMap
  dailyTargetHours: number
}

export interface ExportFileResult {
  filename: string
  blob: Blob
}

/** Extensions the export endpoint can legitimately produce. */
const ALLOWED_EXPORT_EXTENSIONS = ['csv', 'pdf', 'ics']

/**
 * Reduces a server-supplied filename to something safe to hand to
 * `a.download`.
 *
 * The header is server-controlled, but `[^"]+` still permits path separators,
 * newlines and any extension at all — so a compromised or misconfigured
 * backend could suggest `../../evil.exe` and the browser would offer exactly
 * that as the download name. Strip it to a bare basename, drop anything that
 * isn't a plain filename character, and require one of the extensions this
 * endpoint actually produces; anything else falls back to a name we built
 * ourselves.
 */
function safeFilename(candidate: string | undefined, fallback: string): string {
  if (!candidate) return fallback

  // Basename only: everything up to the last / or \ is a path, not a name.
  const basename = candidate.split(/[/\\]/).pop() ?? ''
  const cleaned = basename.replace(/[^A-Za-z0-9._-]/g, '')

  const extension = cleaned.split('.').pop()?.toLowerCase() ?? ''
  if (!cleaned || cleaned.startsWith('.') || !ALLOWED_EXPORT_EXTENSIONS.includes(extension)) {
    return fallback
  }
  return cleaned
}

function filenameFromContentDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="([^"]+)"/)
  return safeFilename(match?.[1], fallback)
}

/**
 * Requests a CSV/PDF/ICS export of the given date range from the backend
 * (Pro plan only) — generation happens server-side; this just ships the
 * client-held days/daysOff data over and streams the resulting file back.
 * Returns null on any failure (offline, backend down, not Pro, etc.).
 */
export async function requestExport(accessToken: string, params: ExportParams): Promise<ExportFileResult | null> {
  const result = await apiFetchRaw({
    path: '/api/v1/export',
    method: 'POST',
    body: params,
    accessToken,
    refreshToken: async () => {
      const user = await refreshAccessToken()
      return user ? loadAccessToken() : null
    },
    // Longer than the default: a PDF spanning the full three-year server-side
    // cap is genuinely slow to render, and cutting it off at 15s would fail a
    // request that was working.
    timeoutMs: EXPORT_TIMEOUT_MS,
  })
  if (!result.ok) return null

  try {
    const blob = await result.value.blob()
    const filename = filenameFromContentDisposition(
      result.value.headers.get('Content-Disposition'),
      `clockflux-export-${params.startDate}-to-${params.endDate}.${params.format}`
    )
    return { filename, blob }
  } catch {
    return null
  }
}

/**
 * Triggers a browser download of an already-fetched export file.
 */
export function downloadExportFile(result: ExportFileResult): void {
  const url = URL.createObjectURL(result.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked on a later tick rather than in the same one as the click. Firefox
  // and several mobile browsers start the download asynchronously, so tearing
  // the object URL down immediately can abort it or produce an empty file.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
