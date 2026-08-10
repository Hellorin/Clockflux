import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCookieConsent } from './useCookieConsent'

describe('useCookieConsent', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with no consent when nothing is stored', () => {
    const { result } = renderHook(() => useCookieConsent())
    expect(result.current.consent).toBeNull()
  })

  it('loads a previously stored choice', () => {
    localStorage.setItem('cookieConsent', 'accepted')
    const { result } = renderHook(() => useCookieConsent())
    expect(result.current.consent).toBe('accepted')
  })

  it('accepts and persists the choice', () => {
    const { result } = renderHook(() => useCookieConsent())
    act(() => result.current.accept())
    expect(result.current.consent).toBe('accepted')
    expect(localStorage.getItem('cookieConsent')).toBe('accepted')
  })

  it('refuses and persists the choice', () => {
    const { result } = renderHook(() => useCookieConsent())
    act(() => result.current.refuse())
    expect(result.current.consent).toBe('refused')
    expect(localStorage.getItem('cookieConsent')).toBe('refused')
  })

  it('ignores a corrupt stored value and treats it as undecided', () => {
    localStorage.setItem('cookieConsent', 'yes-please')
    const { result } = renderHook(() => useCookieConsent())
    expect(result.current.consent).toBeNull()
  })
})
