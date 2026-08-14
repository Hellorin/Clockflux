import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInstallPrompt } from './useInstallPrompt'
import { INSTALL_STORAGE_KEY } from '../repositories/localStorageInstallRepository'

// jsdom's matchMedia always reports no match for display-mode: standalone
// unless a test overrides it, which is what "not already installed" means here.
function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  }
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome, platform: 'web' })
  window.dispatchEvent(event)
  return event
}

describe('useInstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('does not offer to install until the browser fires beforeinstallprompt', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
  })

  it('offers to install once beforeinstallprompt fires, and suppresses the browser mini-infobar', () => {
    const { result } = renderHook(() => useInstallPrompt())
    let event: ReturnType<typeof fireBeforeInstallPrompt>
    act(() => {
      event = fireBeforeInstallPrompt()
    })
    expect(result.current.canInstall).toBe(true)
    expect(event!.defaultPrevented).toBe(true)
  })

  it('records an install and hides the banner when the user accepts the native prompt', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      fireBeforeInstallPrompt('accepted')
    })
    await act(async () => {
      await result.current.promptInstall()
    })
    expect(result.current.canInstall).toBe(false)
    expect(localStorage.getItem(INSTALL_STORAGE_KEY)).toBe('installed')
  })

  it('records a dismissal and hides the banner when the user declines the native prompt', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      fireBeforeInstallPrompt('dismissed')
    })
    await act(async () => {
      await result.current.promptInstall()
    })
    expect(result.current.canInstall).toBe(false)
    expect(localStorage.getItem(INSTALL_STORAGE_KEY)).toBe('dismissed')
  })

  it('hides the banner and records a dismissal when dismiss() is called directly', () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      fireBeforeInstallPrompt()
    })
    act(() => {
      result.current.dismiss()
    })
    expect(result.current.canInstall).toBe(false)
    expect(localStorage.getItem(INSTALL_STORAGE_KEY)).toBe('dismissed')
  })

  it('never offers to install once the app is already marked installed', () => {
    localStorage.setItem(INSTALL_STORAGE_KEY, 'installed')
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      fireBeforeInstallPrompt()
    })
    expect(result.current.canInstall).toBe(false)
  })

  it('never offers to install once dismissed', () => {
    localStorage.setItem(INSTALL_STORAGE_KEY, 'dismissed')
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      fireBeforeInstallPrompt()
    })
    expect(result.current.canInstall).toBe(false)
  })

  it('records an install when the browser fires appinstalled, even without our own prompt', () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(result.current.canInstall).toBe(false)
    expect(localStorage.getItem(INSTALL_STORAGE_KEY)).toBe('installed')
  })
})
