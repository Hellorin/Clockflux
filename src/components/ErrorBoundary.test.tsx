import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

function Boom({ message = 'kaboom' }: { message?: string }): never {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught errors to console.error itself; silence it so a
    // deliberate throw doesn't look like a test failure in the output.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    )

    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('shows a recovery screen instead of a blank page when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload Clockflux' })).toBeInTheDocument()
  })

  it('reports the error so a crash is not invisible', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary onError={onError}>
        <Boom message="specific failure" />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalled()
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toBe('specific failure')
  })

  it('surfaces the error message for a bug report', () => {
    render(
      <ErrorBoundary>
        <Boom message="specific failure" />
      </ErrorBoundary>
    )

    expect(screen.getByText('specific failure')).toBeInTheDocument()
  })

  // The whole point of the recovery path. On the free plan localStorage is the
  // user's only copy of their hours, so a "reset everything" recovery would
  // turn a render bug into permanent data loss.
  it('recovers by reloading and never clears stored data', () => {
    localStorage.setItem('app', '{"days":{"2026-01-01":[]}}')
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { writable: true, value: { ...original, reload } })

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reload Clockflux' }))

    expect(reload).toHaveBeenCalled()
    expect(localStorage.getItem('app')).toBe('{"days":{"2026-01-01":[]}}')

    Object.defineProperty(window, 'location', { writable: true, value: original })
    localStorage.clear()
  })

  it('reassures the user their data is intact', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/nothing has been lost/i)
  })
})
