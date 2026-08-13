import { describe, it, expect, beforeEach } from 'vitest'
import * as installService from './installService'
import { INSTALL_STORAGE_KEY } from '../repositories/localStorageInstallRepository'

describe('installService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reports not installed and not dismissed when nothing is stored', () => {
    expect(installService.hasInstalled()).toBe(false)
    expect(installService.wasDismissed()).toBe(false)
  })

  it('records and reports an install', () => {
    installService.markInstalled()
    expect(installService.hasInstalled()).toBe(true)
    expect(installService.wasDismissed()).toBe(false)
    expect(localStorage.getItem(INSTALL_STORAGE_KEY)).toBe('installed')
  })

  it('records and reports a dismissal', () => {
    installService.markDismissed()
    expect(installService.wasDismissed()).toBe(true)
    expect(installService.hasInstalled()).toBe(false)
  })

  it('never lets a dismissal overwrite a recorded install', () => {
    installService.markInstalled()
    installService.markDismissed()
    expect(installService.hasInstalled()).toBe(true)
    expect(installService.wasDismissed()).toBe(false)
  })
})
