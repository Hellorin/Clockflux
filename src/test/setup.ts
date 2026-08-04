import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  localStorage.clear()
  // These live on <html>/<body> rather than inside the React tree, so cleanup()
  // does not reach them and they would leak between files.
  delete document.documentElement.dataset.theme
  delete document.documentElement.dataset.landing
  delete window.__clockfluxLandingDismissed
  document.getElementById('landing')?.remove()
})

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))
