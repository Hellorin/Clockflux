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

function filenameFromContentDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="([^"]+)"/)
  return match ? match[1] : fallback
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
