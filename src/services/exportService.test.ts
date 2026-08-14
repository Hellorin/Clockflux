import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestExport, downloadExportFile } from './exportService'

const baseParams = {
  format: 'csv' as const,
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  days: {},
  daysOff: {},
  dailyTargetHours: 8,
}

describe('requestExport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the blob and filename parsed from Content-Disposition on success', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('csv content', {
        status: 200,
        headers: { 'Content-Disposition': 'attachment; filename="clockflux-export-2026-07-01-to-2026-07-31.csv"' },
      })
    )

    const result = await requestExport('access-token-123', baseParams)

    expect(result?.filename).toBe('clockflux-export-2026-07-01-to-2026-07-31.csv')
    expect(await result?.blob.text()).toBe('csv content')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/export'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer access-token-123' },
        credentials: 'include',
        body: JSON.stringify(baseParams),
      })
    )
  })

  it('falls back to a generated filename when Content-Disposition is missing', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('x', { status: 200 }))

    const result = await requestExport('access-token-123', baseParams)

    expect(result?.filename).toBe('clockflux-export-2026-07-01-to-2026-07-31.csv')
  })

  it('returns null on a non-OK response (e.g. free plan is forbidden)', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }))

    const result = await requestExport('access-token-123', baseParams)

    expect(result).toBeNull()
  })

  it('returns null when the network request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    const result = await requestExport('access-token-123', baseParams)

    expect(result).toBeNull()
  })
})

describe('downloadExportFile', () => {
  it('creates and clicks a temporary anchor, then revokes the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })

    const clickSpy = vi.fn()
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const anchor = document.createElement('a')
    anchor.click = clickSpy
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)

    downloadExportFile({ filename: 'report.pdf', blob: new Blob(['x']) })

    expect(anchor.download).toBe('report.pdf')
    expect(anchor.href).toBe('blob:mock-url')
    expect(clickSpy).toHaveBeenCalled()
    expect(appendSpy).toHaveBeenCalledWith(anchor)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
})

// The header is server-controlled, but `[^"]+` still permits path separators
// and any extension at all — a compromised or misconfigured backend could
// otherwise put `../../evil.exe` straight into `a.download`.
describe('filename sanitisation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const expectedFallback = `clockflux-export-${baseParams.startDate}-to-${baseParams.endDate}.${baseParams.format}`

  async function filenameFor(disposition: string): Promise<string | undefined> {
    vi.mocked(fetch).mockResolvedValue(
      new Response('csv content', { status: 200, headers: { 'Content-Disposition': disposition } })
    )
    const result = await requestExport('token', baseParams)
    return result?.filename
  }

  it.each([
    ['path traversal', 'attachment; filename="../../etc/passwd.csv"', 'passwd.csv'],
    ['windows path', 'attachment; filename="..\\..\\evil.csv"', 'evil.csv'],
  ])('reduces %s to a bare basename', async (_name, disposition, expected) => {
    expect(await filenameFor(disposition)).toBe(expected)
  })

  it.each([
    ['an executable extension', 'attachment; filename="evil.exe"'],
    ['no extension', 'attachment; filename="evil"'],
    ['a dotfile', 'attachment; filename=".bashrc"'],
    ['a path that reduces to nothing', 'attachment; filename="../../"'],
  ])('falls back to our own name for %s', async (_name, disposition) => {
    expect(await filenameFor(disposition)).toBe(expectedFallback)
  })

  it('strips characters that are not plain filename characters', async () => {
    expect(await filenameFor('attachment; filename="ex port(1)&.csv"')).toBe('export1.csv')
  })

  it('leaves a legitimate filename untouched', async () => {
    expect(await filenameFor('attachment; filename="clockflux-export-2026-07-01-to-2026-07-31.pdf"'))
      .toBe('clockflux-export-2026-07-01-to-2026-07-31.pdf')
  })
})
