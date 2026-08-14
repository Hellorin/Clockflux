import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Reports the error somewhere durable. Kept injectable so tests can assert on it and so an error reporter can be wired in without touching this component. */
  onError?: (error: Error, componentStack: string | null) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time exceptions anywhere below it.
 *
 * Without one, React unmounts the whole tree on any uncaught render error and
 * the user is left staring at a blank white page — no message, no way back,
 * and (since nothing is reported) no way for us to know it happened.
 *
 * Critically, the recovery path here never clears localStorage. On the free
 * plan that storage is the user's *only* copy of their time entries, so
 * "clear everything and reload" would turn a display bug into permanent data
 * loss. Reloading is enough to recover from a bad render.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info.componentStack ?? null)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="app-crash" role="alert">
        <h1 className="app-crash__title">Something went wrong</h1>
        <p className="app-crash__text">
          Clockflux hit an unexpected error and couldn&rsquo;t finish loading this screen.
          Your tracked hours are still saved on this device &mdash; nothing has been lost.
        </p>
        <button type="button" className="app-crash__btn" onClick={this.handleReload}>
          Reload Clockflux
        </button>
        <p className="app-crash__text app-crash__text--muted">
          If it keeps happening, email{' '}
          <a href="mailto:info@clockflux.app">info@clockflux.app</a> and mention what you
          were doing.
        </p>
        {/* Shown rather than hidden behind devtools: most people who hit this
            are on a phone, where reading the console isn't an option, and it's
            the only detail that makes a bug report actionable. */}
        <details className="app-crash__details">
          <summary>Technical details</summary>
          <pre className="app-crash__pre">{error.message}</pre>
        </details>
      </div>
    )
  }
}
