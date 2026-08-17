import { describe, it, expect } from 'vitest'
// Vite's ?raw loader, so this needs no node typings.
import vercelConfig from '../../vercel.json?raw'
import nginxConf from '../../nginx.conf?raw'

/**
 * The 2026-08-14 production-readiness audit found `connect-src ... https://XXX`
 * — an unresolved placeholder — shipped in the production CSP of both deploy
 * paths. Since the API lives on a different origin from the app, that blocked
 * every single fetch: sign-in, token refresh, sync, settings, features, export
 * and the whole billing flow. The app was dead on arrival in production while
 * working perfectly in dev, because the Vite dev server never applies these
 * headers.
 *
 * It had in fact already been reported as M2 in the 2026-08-13 security review,
 * and was then copy-pasted into two more files before anyone caught it. These
 * tests are the standing guard against both halves of that failure: the
 * placeholder coming back, and the copies drifting apart.
 *
 * The complementary check — that the origin in the policy is the one this
 * bundle will actually call — needs VITE_API_URL and so lives in
 * scripts/check-csp.mjs, wired to `prebuild`.
 */

/**
 * Every CSP string embedded in a file, in source order.
 *
 * Matched on the policy body rather than on the `Content-Security-Policy`
 * header name, because the two are on the same line in nginx.conf but are
 * separate JSON fields ("key" then "value") in vercel.json.
 */
function policiesIn(source: string): string[] {
  return [...source.matchAll(/default-src[^"]*/g)].map(m => m[0])
}

const vercelPolicies = policiesIn(vercelConfig)
// Two: the server-level header, and the one re-declared inside the /assets/
// location block — nginx's add_header does not inherit into a block that
// declares any add_header of its own, so dropping the second copy would
// silently serve assets with no CSP at all.
const nginxPolicies = policiesIn(nginxConf)

const allPolicies = [...vercelPolicies, ...nginxPolicies]

describe('Content-Security-Policy', () => {
  it('is declared in both deploy paths', () => {
    expect(vercelPolicies).toHaveLength(1)
    expect(nginxPolicies).toHaveLength(2)
  })

  it.each(allPolicies.map((policy, i) => [i, policy]))(
    'policy %i carries no unresolved placeholder',
    (_i, policy) => {
      expect(policy).not.toMatch(/XXX/)
    }
  )

  it.each(allPolicies.map((policy, i) => [i, policy]))(
    'policy %i allows an absolute https API origin in connect-src',
    (_i, policy) => {
      const connectSrc = /connect-src ([^;]*)/.exec(policy)?.[1]
      expect(connectSrc).toBeTruthy()
      // 'self' alone is not enough: the API is a separate origin, so a policy
      // without an absolute https:// source blocks every API call.
      expect(connectSrc).toMatch(/https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i)
    }
  )

  it('keeps vercel.json and nginx.conf byte-identical', () => {
    // Three hand-maintained copies of one 500-character string is exactly how
    // the XXX placeholder ended up in all of them. If they must be duplicated,
    // they at least have to be duplicated correctly.
    for (const policy of nginxPolicies) {
      expect(policy).toBe(vercelPolicies[0])
    }
  })

  it('keeps the directives that make the rest of the policy meaningful', () => {
    for (const policy of allPolicies) {
      expect(policy).toContain("object-src 'none'")
      expect(policy).toContain("base-uri 'self'")
      expect(policy).toContain("frame-ancestors 'none'")
      // Google Identity Services is loaded as a script and framed for the
      // one-tap/redirect flow; dropping either breaks sign-in.
      expect(policy).toContain('https://accounts.google.com/gsi/client')
      expect(policy).toContain('frame-src https://accounts.google.com/gsi/')
    }
  })
})
