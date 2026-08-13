import { describe, it, expect, beforeEach } from 'vitest'
import { reconcileOwner } from './localDataOwnershipService'
import { DEFAULT_SETTINGS } from '../hooks/useAppSettings'
import { localStorageOwnershipRepository } from '../repositories/localStorageOwnershipRepository'

const settings = { ...DEFAULT_SETTINGS, annualHolidayAllowance: 20 }

describe('reconcileOwner', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('claims unclaimed local data for the first account that signs in, without changing it', () => {
    const current = { days: { '2026-08-01': [{ checkIn: '2026-08-01T09:00:00Z', checkOut: null }] }, daysOff: {}, settings }

    const result = reconcileOwner('a@example.com', current)

    expect(result.data).toBeNull()
    expect(localStorageOwnershipRepository.loadOwnerId()).toBe('a@example.com')
  })

  it('is a no-op when the same owner signs in again', () => {
    const current = { days: { '2026-08-01': [{ checkIn: '2026-08-01T09:00:00Z', checkOut: null }] }, daysOff: {}, settings }
    reconcileOwner('a@example.com', current)

    const result = reconcileOwner('a@example.com', current)

    expect(result.data).toBeNull()
  })

  it('backs up and resets local data when a different account signs in, never returning it to be pushed/rendered', () => {
    const ownerAData = { days: { '2026-08-01': [{ checkIn: '2026-08-01T09:00:00Z', checkOut: null }] }, daysOff: {}, settings }
    reconcileOwner('a@example.com', ownerAData)

    const result = reconcileOwner('b@example.com', ownerAData)

    expect(result.data).toEqual({ days: {}, daysOff: {}, settings: DEFAULT_SETTINGS })
    expect(localStorageOwnershipRepository.loadOwnerId()).toBe('b@example.com')
    expect(localStorageOwnershipRepository.loadBackup('a@example.com')).toEqual(ownerAData)
  })

  it('restores a returning owner\'s backup when they sign back in on a device now owned by someone else', () => {
    const ownerAData = { days: { '2026-08-01': [{ checkIn: '2026-08-01T09:00:00Z', checkOut: null }] }, daysOff: {}, settings }
    reconcileOwner('a@example.com', ownerAData)

    const ownerBData = { days: { '2026-08-05': [{ checkIn: '2026-08-05T09:00:00Z', checkOut: null }] }, daysOff: {}, settings: DEFAULT_SETTINGS }
    reconcileOwner('b@example.com', ownerAData) // A's data gets backed up, active resets

    const result = reconcileOwner('a@example.com', ownerBData)

    expect(result.data).toEqual(ownerAData)
    expect(localStorageOwnershipRepository.loadOwnerId()).toBe('a@example.com')
    // The restored backup is consumed, not left dangling.
    expect(localStorageOwnershipRepository.loadBackup('a@example.com')).toBeNull()
  })
})
