import { describe, it, expect } from 'vitest'
import { decodeGoogleCredential } from './authService'

function makeCredential(claims: Record<string, unknown>): string {
  const base64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url(claims)}.signature`
}

describe('decodeGoogleCredential', () => {
  it('extracts name, email, and picture from the token payload', () => {
    const credential = makeCredential({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      picture: 'https://example.com/ada.png',
    })
    expect(decodeGoogleCredential(credential)).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      picture: 'https://example.com/ada.png',
    })
  })

  it('falls back to email when name is missing, and empty picture when absent', () => {
    const credential = makeCredential({ email: 'ada@example.com' })
    expect(decodeGoogleCredential(credential)).toEqual({
      name: 'ada@example.com',
      email: 'ada@example.com',
      picture: '',
    })
  })

  it('returns null when the token has no email claim', () => {
    const credential = makeCredential({ name: 'Ada Lovelace' })
    expect(decodeGoogleCredential(credential)).toBeNull()
  })

  it('returns null for a malformed token', () => {
    expect(decodeGoogleCredential('not-a-jwt')).toBeNull()
  })
})
