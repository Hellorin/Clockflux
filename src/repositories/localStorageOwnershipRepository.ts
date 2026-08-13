import type { Settings, TimeEntriesData } from '../types'
import type { OwnershipRepository } from './types'

// Exported so the privacy notice in index.html can be checked against the keys
// actually in use — see src/test/indexHtml.test.ts.
export const OWNER_STORAGE_KEY = 'appDataOwner'
export const BACKUPS_STORAGE_KEY = 'appDataOwnerBackups'

type Backup = TimeEntriesData & { settings: Settings }
type BackupsById = Record<string, Backup>

function loadBackups(): BackupsById {
  try {
    const raw = localStorage.getItem(BACKUPS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveBackups(backups: BackupsById): void {
  localStorage.setItem(BACKUPS_STORAGE_KEY, JSON.stringify(backups))
}

export const localStorageOwnershipRepository: OwnershipRepository = {
  loadOwnerId(): string | null {
    try {
      return localStorage.getItem(OWNER_STORAGE_KEY)
    } catch {
      return null
    }
  },
  saveOwnerId(ownerId: string): void {
    localStorage.setItem(OWNER_STORAGE_KEY, ownerId)
  },
  // All owners' set-aside snapshots live under one key rather than one key
  // per owner, so the app's storage footprint stays fixed and enumerable
  // (see the privacy notice in index.html) instead of growing with every
  // account that ever touches this device.
  loadBackup(ownerId: string): Backup | null {
    return loadBackups()[ownerId] ?? null
  },
  saveBackup(ownerId: string, data: Backup): void {
    const backups = loadBackups()
    backups[ownerId] = data
    saveBackups(backups)
  },
  clearBackup(ownerId: string): void {
    const backups = loadBackups()
    if (!(ownerId in backups)) return
    delete backups[ownerId]
    saveBackups(backups)
  },
}
