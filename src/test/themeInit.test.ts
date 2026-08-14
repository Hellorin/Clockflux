import { describe, it, expect, beforeEach, afterEach } from 'vitest'
// Vite's ?raw loader, so this needs no node typings.
import themeInit from '../../public/theme-init.js?raw'

// public/theme-init.js runs before any module loads, so no component test ever
// touches it. It reads localStorage straight into a CSS custom property, which
// makes it the one place a stored value reaches the CSSOM without passing
// through useAppSettings' validation — these assertions are its only cover.

function runThemeInit() {
  // Executes the real shipped script rather than a copy, so this can't drift
  // from what the browser actually runs.
  new Function(themeInit)()
}

describe('theme-init.js', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('style')
  })

  it('applies a valid hex colour before first paint', () => {
    localStorage.setItem('appSettings', JSON.stringify({ themeLightColor: '#fffbf5', themeDarkColor: '#1A1A2E' }))

    runThemeInit()

    expect(document.documentElement.style.getPropertyValue('--bg-light-color')).toBe('#fffbf5')
    expect(document.documentElement.style.getPropertyValue('--bg-dark-color')).toBe('#1A1A2E')
  })

  it.each([
    ['a CSS injection attempt', 'red; background-image: url(http://evil.example/x)'],
    ['a url() function', 'url(http://evil.example)'],
    ['a named colour', 'red'],
    ['shorthand hex', '#fff'],
    ['a non-string', 42],
    ['an object', { toString: () => '#fffbf5' }],
  ])('ignores %s', (_name, value) => {
    localStorage.setItem('appSettings', JSON.stringify({ themeLightColor: value, themeDarkColor: value }))

    runThemeInit()

    expect(document.documentElement.style.getPropertyValue('--bg-light-color')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--bg-dark-color')).toBe('')
  })

  it('survives unparseable stored settings', () => {
    localStorage.setItem('appSettings', 'not json')

    expect(() => runThemeInit()).not.toThrow()
    expect(document.documentElement.style.getPropertyValue('--bg-light-color')).toBe('')
  })

  it('still sets the checked-in theme regardless of the colours', () => {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem('app', JSON.stringify({ days: { [today]: [{ checkIn: '09:00', checkOut: null }] } }))

    runThemeInit()

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
