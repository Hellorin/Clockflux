import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { act } from '@testing-library/react'
import GoogleSignInButton from './GoogleSignInButton'

const GIS_SCRIPT_ID = 'google-identity-services'

function flushGisScriptLoad() {
  const script = document.getElementById(GIS_SCRIPT_ID)
  script?.dispatchEvent(new Event('load'))
}

describe('GoogleSignInButton', () => {
  afterEach(() => {
    document.getElementById(GIS_SCRIPT_ID)?.remove()
    delete (window as { google?: unknown }).google
  })

  it('initializes Google Identity Services in redirect mode, pointed at the backend callback', async () => {
    const initialize = vi.fn()
    const renderButton = vi.fn()
    window.google = { accounts: { id: { initialize, renderButton } } }

    render(<GoogleSignInButton user={null} onSignIn={vi.fn()} onSignOut={vi.fn()} />)
    await act(async () => {
      flushGisScriptLoad()
    })

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        ux_mode: 'redirect',
        login_uri: expect.stringContaining('/api/v1/auth/google/callback'),
      })
    )
    expect(renderButton).toHaveBeenCalled()
  })

  it('renders nothing that re-initializes once a user is signed in', async () => {
    const initialize = vi.fn()
    window.google = { accounts: { id: { initialize, renderButton: vi.fn() } } }

    const user = { name: 'Ada Lovelace', email: 'ada@example.com', picture: '', plan: 'free' as const }
    render(<GoogleSignInButton user={user} onSignIn={vi.fn()} onSignOut={vi.fn()} />)

    expect(initialize).not.toHaveBeenCalled()
  })
})
