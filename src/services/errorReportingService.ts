/**
 * Where unexpected errors go.
 *
 * There is deliberately no third-party SDK wired in here. Adding one needs a
 * hosted account, a DSN, and a matching `connect-src` entry in the CSP
 * (vercel.json / nginx.conf) — none of which belong in application code. What
 * this gives instead is the seam: everything that can crash already reports
 * through `reportError`, so installing a real reporter is `setErrorReporter(…)`
 * in main.tsx and nothing else.
 *
 * Until then, errors at least reach the console with a consistent prefix
 * instead of vanishing.
 */

export interface ErrorReport {
  error: Error
  /** React's component stack, when the error came from a render. */
  componentStack?: string | null
  /** How the error reached us — useful for telling a render crash apart from a stray promise rejection. */
  source: 'render' | 'window' | 'unhandledrejection'
}

export type ErrorReporter = (report: ErrorReport) => void

const LOG_PREFIX = '[clockflux:error]'

const consoleReporter: ErrorReporter = ({ error, componentStack, source }) => {
  // console.error rather than console.log: this is the one thing in the app
  // that should survive a "strip logs in production" pass.
  console.error(LOG_PREFIX, source, error, componentStack ?? '')
}

let reporter: ErrorReporter = consoleReporter

/**
 * Replaces the reporter. Call once at startup, before rendering. Passing null
 * restores console-only reporting (used by tests to undo themselves).
 */
export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next ?? consoleReporter
}

/**
 * Reports a render-time error. Signature matches ErrorBoundary's onError so it
 * can be passed straight through.
 */
export function reportError(error: Error, componentStack: string | null = null): void {
  report({ error, componentStack, source: 'render' })
}

function report(payload: ErrorReport): void {
  try {
    reporter(payload)
  } catch {
    // A failing reporter must never become the thing that breaks the page —
    // this is the last line of the error path, so it has nowhere to escalate.
  }
}

/**
 * Catches the errors an ErrorBoundary structurally cannot: exceptions thrown
 * outside React's render cycle (event handlers, timers, the service worker
 * registration) and rejected promises nobody awaited — which is exactly the
 * shape of every failed `fetch` in this app.
 *
 * Returns a teardown function.
 */
export function installGlobalErrorHandlers(): () => void {
  const onError = (event: ErrorEvent) => {
    report({
      error: event.error instanceof Error ? event.error : new Error(event.message),
      source: 'window',
    })
  }

  const onRejection = (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason
    report({
      error: reason instanceof Error ? reason : new Error(String(reason)),
      source: 'unhandledrejection',
    })
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)

  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
