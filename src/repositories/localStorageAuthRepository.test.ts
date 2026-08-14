import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  localStorageAuthRepository,
  STORAGE_KEY,
  ACCESS_TOKEN_STORAGE_KEY,
  HAS_SIGNED_IN_BEFORE_KEY,
} from './localStorageAuthRepository'
import type { AuthUser } from '../types'

const user: AuthUser = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  picture: 'https://example.com/a.png',
  plan: 'pro',
  cancelAtPeriodEnd: false,
}

describe('localStorageAuthRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('round-trips a saved user', () => {
    localStorageAuthRepository.saveUser(user)

    expect(localStorageAuthRepository.loadUser()).toEqual(user)
  })

  it('returns null when nothing is stored', () => {
    expect(localStorageAuthRepository.loadUser()).toBeNull()
  })

  // The stored value drives plan-based routing and feature flags, and anything
  // on the origin can write it. It used to be cast straight to AuthUser.
  it.each([
    ['malformed JSON', 'not json at all'],
    ['a JSON primitive', '"just a string"'],
    ['null', 'null'],
    ['an empty object', '{}'],
    ['a missing email', JSON.stringify({ name: 'A', picture: '', plan: 'pro' })],
    ['a non-string name', JSON.stringify({ name: 42, email: 'a@b.c', picture: '', plan: 'pro' })],
    ['an unknown plan', JSON.stringify({ name: 'A', email: 'a@b.c', picture: '', plan: 'enterprise' })],
  ])('treats %s as signed out rather than trusting it', (_name, raw) => {
    localStorage.setItem(STORAGE_KEY, raw)

    expect(localStorageAuthRepository.loadUser()).toBeNull()
  })

  it('accepts a stored user written before optional fields existed', () => {
    // Older versions did not persist cancelAtPeriodEnd; the guard checks only
    // the fields the app actually branches on, so those must still load.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ name: 'A', email: 'a@b.c', picture: '', plan: 'free' })
    )

    expect(localStorageAuthRepository.loadUser()).not.toBeNull()
  })

  it('clears the user and token independently of the signed-in-before marker', () => {
    localStorageAuthRepository.saveUser(user)
    localStorageAuthRepository.saveAccessToken('token-123')
    localStorageAuthRepository.markSignedInBefore()

    localStorageAuthRepository.clearUser()
    localStorageAuthRepository.clearAccessToken()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull()
    // Deliberately survives sign-out so the app can tell "signed in here
    // before" apart from "never signed in".
    expect(localStorage.getItem(HAS_SIGNED_IN_BEFORE_KEY)).toBe('true')
    expect(localStorageAuthRepository.hasSignedInBefore()).toBe(true)
  })
})
