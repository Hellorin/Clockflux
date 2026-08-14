import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InstallPrompt from './InstallPrompt'
import * as useInstallPromptModule from '../hooks/useInstallPrompt'

vi.mock('../hooks/useInstallPrompt')

describe('InstallPrompt', () => {
  it('renders nothing when the hook says not to offer install', () => {
    vi.mocked(useInstallPromptModule.useInstallPrompt).mockReturnValue({
      canInstall: false,
      promptInstall: vi.fn(),
      dismiss: vi.fn(),
    })
    const { container } = render(<InstallPrompt />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the banner and wires the install/dismiss actions when installable', () => {
    const promptInstall = vi.fn()
    const dismiss = vi.fn()
    vi.mocked(useInstallPromptModule.useInstallPrompt).mockReturnValue({
      canInstall: true,
      promptInstall,
      dismiss,
    })
    render(<InstallPrompt />)

    expect(screen.getByText('Install Clockflux')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(promptInstall).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(dismiss).toHaveBeenCalled()
  })
})
