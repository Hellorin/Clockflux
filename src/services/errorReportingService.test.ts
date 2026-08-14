import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  installGlobalErrorHandlers,
  reportError,
  setErrorReporter,
  type ErrorReport,
} from './errorReportingService'

describe('errorReportingService', () => {
  let reports: ErrorReport[]

  beforeEach(() => {
    reports = []
    setErrorReporter(report => reports.push(report))
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    setErrorReporter(null)
    vi.restoreAllMocks()
  })

  it('forwards render errors with their component stack', () => {
    const error = new Error('render blew up')

    reportError(error, '\n    at Thing')

    expect(reports).toEqual([{ error, componentStack: '\n    at Thing', source: 'render' }])
  })

  it('falls back to the console when no reporter is installed', () => {
    setErrorReporter(null)

    reportError(new Error('boom'))

    expect(console.error).toHaveBeenCalled()
  })

  // A failure inside the reporter is the one place with nowhere left to
  // escalate to, so it must not propagate and break the page.
  it('swallows a throwing reporter', () => {
    setErrorReporter(() => {
      throw new Error('reporter itself is broken')
    })

    expect(() => reportError(new Error('boom'))).not.toThrow()
  })

  describe('global handlers', () => {
    let teardown: () => void

    beforeEach(() => {
      teardown = installGlobalErrorHandlers()
    })

    afterEach(() => {
      teardown()
    })

    it('captures errors thrown outside React, which no boundary can catch', () => {
      const error = new Error('from a timer')

      window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }))

      expect(reports).toHaveLength(1)
      expect(reports[0].source).toBe('window')
      expect(reports[0].error).toBe(error)
    })

    // Every fetch in this app returns a promise; an unawaited rejection is the
    // most likely shape of a real production error here.
    it('captures unhandled promise rejections', () => {
      const error = new Error('fetch never awaited')

      window.dispatchEvent(
        Object.assign(new Event('unhandledrejection'), { reason: error }) as unknown as Event
      )

      expect(reports).toHaveLength(1)
      expect(reports[0].source).toBe('unhandledrejection')
      expect(reports[0].error).toBe(error)
    })

    it('wraps a non-Error rejection reason so the reporter always gets an Error', () => {
      window.dispatchEvent(
        Object.assign(new Event('unhandledrejection'), { reason: 'just a string' }) as unknown as Event
      )

      expect(reports[0].error).toBeInstanceOf(Error)
      expect(reports[0].error.message).toBe('just a string')
    })

    it('detaches both listeners on teardown', () => {
      // Asserted via removeEventListener rather than by dispatching another
      // ErrorEvent: with no listener left, jsdom escalates that to a genuine
      // uncaught exception and fails the run.
      const remove = vi.spyOn(window, 'removeEventListener')

      teardown()

      const events = remove.mock.calls.map(([type]) => type)
      expect(events).toContain('error')
      expect(events).toContain('unhandledrejection')
    })
  })
})
