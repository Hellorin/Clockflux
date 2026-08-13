import type { InstallRepository } from './types'

// Named for the privacy notice in index.html, which has to list every key the
// app writes — src/test/indexHtml.test.ts asserts the two stay in step.
export const INSTALL_STORAGE_KEY = 'appInstallState'
const INSTALLED_VALUE = 'installed'
const DISMISSED_VALUE = 'dismissed'

export const localStorageInstallRepository: InstallRepository = {
  hasInstalled(): boolean {
    try {
      return localStorage.getItem(INSTALL_STORAGE_KEY) === INSTALLED_VALUE
    } catch {
      return false
    }
  },
  markInstalled(): void {
    try {
      localStorage.setItem(INSTALL_STORAGE_KEY, INSTALLED_VALUE)
    } catch {
      // Storage unavailable (e.g. Safari private mode). The install banner
      // may show again next visit, which is a fine degradation.
    }
  },
  wasDismissed(): boolean {
    try {
      return localStorage.getItem(INSTALL_STORAGE_KEY) === DISMISSED_VALUE
    } catch {
      return false
    }
  },
  markDismissed(): void {
    try {
      // Never downgrade an already-recorded install back to "dismissed" —
      // markDismissed only ever runs before an install happens in practice,
      // but this keeps the two states from racing if it ever doesn't.
      if (localStorage.getItem(INSTALL_STORAGE_KEY) === INSTALLED_VALUE) return
      localStorage.setItem(INSTALL_STORAGE_KEY, DISMISSED_VALUE)
    } catch {
      // Storage unavailable — the banner may show again next visit, which is
      // a fine degradation.
    }
  },
}
