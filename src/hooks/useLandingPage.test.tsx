import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { useLandingPage } from './useLandingPage'
import { mountLandingFixture } from '../test/landingFixture'
import { VISIT_STORAGE_KEY } from '../repositories/localStorageVisitRepository'

describe('useLandingPage', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.landing
    delete window.__clockfluxLandingDismissed
    window.location.hash = ''
    // Stubbed once on the prototype in src/test/setup.ts, so call history would
    // otherwise carry across cases.
    vi.mocked(Element.prototype.scrollIntoView).mockClear()
  })

  it('stays inert when the landing markup is absent', () => {
    const { result } = renderHook(() => useLandingPage())
    expect(result.current.isLandingOpen).toBe(false)
    expect(document.documentElement.dataset.landing).toBeUndefined()
  })

  it('opens on a first visit and records the visit', () => {
    mountLandingFixture()
    const { result } = renderHook(() => useLandingPage())
    expect(result.current.isLandingOpen).toBe(true)
    expect(document.documentElement.dataset.landing).toBe('visible')
    expect(localStorage.getItem(VISIT_STORAGE_KEY)).toBe('1')
  })

  it('stays closed for a returning visitor and leaves focus alone', () => {
    mountLandingFixture()
    document.documentElement.dataset.landing = 'hidden'
    const returnFocusRef = createRef<HTMLButtonElement>()
    const button = document.createElement('button')
    document.body.appendChild(button)
    returnFocusRef.current = button

    const { result } = renderHook(() => useLandingPage({ returnFocusRef }))

    expect(result.current.isLandingOpen).toBe(false)
    expect(document.documentElement.dataset.landing).toBe('hidden')
    expect(document.activeElement).not.toBe(button)
    button.remove()
  })

  it('stays closed for a returning visitor even if the pre-paint script never ran', () => {
    mountLandingFixture()
    localStorage.setItem(VISIT_STORAGE_KEY, '1')

    const { result } = renderHook(() => useLandingPage())

    expect(result.current.isLandingOpen).toBe(false)
    expect(document.documentElement.dataset.landing).toBe('hidden')
  })

  it('closes when a dismiss control is clicked', () => {
    const landing = mountLandingFixture()
    const { result } = renderHook(() => useLandingPage())

    act(() => {
      fireEvent.click(landing.querySelector('[data-landing-dismiss]')!)
    })

    expect(result.current.isLandingOpen).toBe(false)
    expect(document.documentElement.dataset.landing).toBe('hidden')
  })

  it('closes on Escape while open and ignores it once closed', () => {
    mountLandingFixture()
    const { result } = renderHook(() => useLandingPage())

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(result.current.isLandingOpen).toBe(false)

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(result.current.isLandingOpen).toBe(false)
    expect(document.documentElement.dataset.landing).toBe('hidden')
  })

  it('re-opens without clearing the visited flag', () => {
    mountLandingFixture()
    document.documentElement.dataset.landing = 'hidden'
    localStorage.setItem(VISIT_STORAGE_KEY, '1')
    const { result } = renderHook(() => useLandingPage())
    expect(result.current.isLandingOpen).toBe(false)

    act(() => result.current.openLanding())

    expect(result.current.isLandingOpen).toBe(true)
    expect(document.documentElement.dataset.landing).toBe('visible')
    expect(localStorage.getItem(VISIT_STORAGE_KEY)).toBe('1')
  })

  it('focuses the landing on open and restores focus on close', () => {
    const landing = mountLandingFixture()
    document.documentElement.dataset.landing = 'hidden'
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { result } = renderHook(() => useLandingPage())

    act(() => result.current.openLanding())
    expect(document.activeElement).toBe(landing)

    act(() => result.current.closeLanding())
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('falls back to returnFocusRef when nothing was focused beforehand', () => {
    mountLandingFixture()
    const returnFocusRef = createRef<HTMLButtonElement>()
    const about = document.createElement('button')
    document.body.appendChild(about)
    returnFocusRef.current = about

    const { result } = renderHook(() => useLandingPage({ returnFocusRef }))
    expect(result.current.isLandingOpen).toBe(true)

    act(() => result.current.closeLanding())

    expect(document.activeElement).toBe(about)
    about.remove()
  })

  it('opens at the privacy notice for a returning visitor following the link', () => {
    const landing = mountLandingFixture()
    document.documentElement.dataset.landing = 'hidden'
    localStorage.setItem(VISIT_STORAGE_KEY, '1')
    window.location.hash = '#privacy'

    const { result } = renderHook(() => useLandingPage())

    expect(result.current.isLandingOpen).toBe(true)
    expect(document.documentElement.dataset.landing).toBe('visible')
    expect(landing.querySelector('#privacy')!.scrollIntoView).toHaveBeenCalled()
    // The notice is reachable without re-arming the landing for the next visit.
    expect(localStorage.getItem(VISIT_STORAGE_KEY)).toBe('1')
  })

  it('leaves the scroll alone when the landing is re-opened from the header', () => {
    mountLandingFixture()
    document.documentElement.dataset.landing = 'hidden'
    localStorage.setItem(VISIT_STORAGE_KEY, '1')
    const { result } = renderHook(() => useLandingPage())

    // The hash sticks around in the address bar after a visit to the notice, so
    // re-opening must not silently jump past the copy the button is there for.
    window.location.hash = '#privacy'
    act(() => result.current.openLanding())

    expect(result.current.isLandingOpen).toBe(true)
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })

  it('opens the notice when the hash changes without a reload', () => {
    // Following a #privacy link from inside the tracker never re-mounts, so the
    // initial read cannot be what handles this.
    const landing = mountLandingFixture()
    document.documentElement.dataset.landing = 'hidden'
    localStorage.setItem(VISIT_STORAGE_KEY, '1')
    const { result } = renderHook(() => useLandingPage())
    expect(result.current.isLandingOpen).toBe(false)

    act(() => {
      window.location.hash = '#privacy'
      fireEvent(window, new HashChangeEvent('hashchange'))
    })

    expect(result.current.isLandingOpen).toBe(true)
    expect(landing.querySelector('#privacy')!.scrollIntoView).toHaveBeenCalled()
  })

  it('ignores a hash change to anything other than the notice', () => {
    mountLandingFixture()
    document.documentElement.dataset.landing = 'hidden'
    localStorage.setItem(VISIT_STORAGE_KEY, '1')
    const { result } = renderHook(() => useLandingPage())

    act(() => {
      window.location.hash = '#somewhere-else'
      fireEvent(window, new HashChangeEvent('hashchange'))
    })

    expect(result.current.isLandingOpen).toBe(false)
  })

  it('lets a pre-hydration dismiss win over the privacy hash', () => {
    mountLandingFixture()
    window.location.hash = '#privacy'
    window.__clockfluxLandingDismissed = true

    const { result } = renderHook(() => useLandingPage())

    expect(result.current.isLandingOpen).toBe(false)
  })

  it('honours a dismiss click that landed before hydration', () => {
    mountLandingFixture()
    window.__clockfluxLandingDismissed = true

    const { result } = renderHook(() => useLandingPage())

    expect(result.current.isLandingOpen).toBe(false)
    expect(document.documentElement.dataset.landing).toBe('hidden')
  })
})
