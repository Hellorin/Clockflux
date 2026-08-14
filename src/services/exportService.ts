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
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
      body: JSON.stringify(params),
    })
    if (!response.ok) return null
    const blob = await response.blob()
    const filename = filenameFromContentDisposition(
      response.headers.get('Content-Disposition'),
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
  URL.revokeObjectURL(url)
}
