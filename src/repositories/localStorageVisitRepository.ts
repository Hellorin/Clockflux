import type { VisitRepository } from './types'

// Duplicated by the pre-paint inline script in index.html, which has to decide
// whether to show the landing page before any module can load. src/test/
// indexHtml.test.ts imports this constant and asserts the raw HTML still
// contains it, so the two can't drift apart silently.
export const VISIT_STORAGE_KEY = 'timeforgeVisited'
const VISITED_VALUE = '1'

export const localStorageVisitRepository: VisitRepository = {
  hasVisited(): boolean {
    try {
      return localStorage.getItem(VISIT_STORAGE_KEY) === VISITED_VALUE
    } catch {
      return false
    }
  },
  markVisited(): void {
    try {
      localStorage.setItem(VISIT_STORAGE_KEY, VISITED_VALUE)
    } catch {
      // Storage unavailable (e.g. Safari private mode). The landing page shows
      // again on the next visit, which is a fine degradation.
    }
  },
}
