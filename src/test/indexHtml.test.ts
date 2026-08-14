import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { VISIT_STORAGE_KEY } from '../repositories/localStorageVisitRepository'
// Vite's ?raw loader, so this needs no node typings.
import html from '../../index.html?raw'
import robots from '../../public/robots.txt?raw'
import sitemap from '../../public/sitemap.xml?raw'
import landingInit from '../../public/landing-init.js?raw'
import vercelConfig from '../../vercel.json?raw'
import viteConfig from '../../vite.config.js?raw'
import appTsx from '../App.tsx?raw'

// The landing page and the SEO tags are static markup in index.html, which no
// component test ever loads — Vitest imports App directly. These assertions are
// the only automated cover for that file.

const CANONICAL = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1]

describe('index.html', () => {
  it('points at the real entry module', () => {
    // Regression lock: this said main.jsx for several commits after the
    // TypeScript migration renamed the file, and the build was broken.
    expect(html).toContain('src="/src/main.tsx"')
    expect(html).not.toContain('main.jsx')
  })

  it('provides the DOM contract useLandingPage depends on', () => {
    expect(html).toContain('id="landing"')
    expect(html).toContain('data-landing-dismiss')
    expect(html).toContain('id="landing-title"')
  })

  it('uses the same storage key as the visit repository', () => {
    // The pre-paint script has to duplicate this literal — it runs before any
    // module can load. This is what stops the two from drifting apart.
    expect(landingInit).toContain(`localStorage.getItem('${VISIT_STORAGE_KEY}')`)
  })

  it('declares exactly one top-level heading', () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
  })

  it('carries the SEO head tags', () => {
    expect(html).toMatch(/<meta name="description" content="[^"]{50,}"/)
    expect(CANONICAL).toBeTruthy()
  })

  it('embeds valid WebApplication structured data', () => {
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1]
    expect(ld).toBeTruthy()
    const parsed = JSON.parse(ld!)
    expect(parsed['@type']).toBe('WebApplication')
    expect(parsed.url).toBe(CANONICAL)
    expect(parsed.featureList.length).toBeGreaterThan(0)
  })

  // The full storage-key-by-storage-key disclosure, the analytics section, and
  // the signing-in details (refresh_token, HttpOnly, erasure, export) used to
  // live here and were guarded by name. That text is now the privacy notice on
  // clockflux-info-front (see its src/pages/PrivacyPage.test.tsx for the
  // equivalent coverage) — this page keeps only a short, still-accurate
  // summary and a link to the full notice, checked below.

  it('summarizes privacy honestly and points to the full notice', () => {
    expect(html).toMatch(/Stripe/)
    expect(html).toMatch(/MongoDB Atlas/)
    expect(html).toMatch(/Fly\.io/)
    // Must not repeat claims (e.g. "sets no cookies at all") that the full
    // notice on the info app has already had to walk back once.
    expect(html).not.toMatch(/sets no cookies at all/)
  })

  it('links to the full privacy notice through the env placeholder, not a hardcoded host', () => {
    // Same reasoning as the account-site link below: a literal
    // https://info.clockflux.app here would jump straight to production from
    // a dev server. vite.config.js substitutes this at build and dev-serve
    // time; see crossAppUrlsInHtml there.
    expect(html).toContain('href="%VITE_INFO_URL%/privacy"')
    expect(html).not.toContain('href="https://info.clockflux.app')
  })

  it('keeps the pre-paint script in step with the privacy deep link', () => {
    // Mirrors isPrivacyDeepLink() in src/hooks/useLandingPage.ts. If the script
    // hides the landing regardless of the hash, the notice becomes unreachable
    // for everyone who has already used the app.
    expect(landingInit).toMatch(/location\.hash !== '#privacy'/)
  })

  it('keeps the indexable copy that the page exists for', () => {
    expect(html).toMatch(/work hours/i)
    expect(html).toMatch(/offline/i)
    expect(html).toMatch(/holiday/i)
  })

  it('links to the account site through the env placeholder, not a hardcoded host', () => {
    // A literal https://account.clockflux.app here would jump straight to
    // production from a dev server. vite.config.js substitutes this at build
    // and dev-serve time; see accountUrlInHtml there.
    expect(html).toContain('href="%VITE_ACCOUNT_URL%/"')
    expect(html).not.toContain('href="https://account.clockflux.app')
  })

  it('uses the same account-site fallback in the HTML and in App.tsx', () => {
    // Two independent code paths link to the account site — the static
    // markup (via vite.config.js) and Settings (via App.tsx) — so they need
    // the same default when VITE_ACCOUNT_URL is unset.
    const fallbackIn = (source: string) =>
      /['"](https:\/\/account\.clockflux\.app)['"]/.exec(source)?.[1]

    expect(fallbackIn(viteConfig)).toBeTruthy()
    expect(fallbackIn(appTsx)).toBe(fallbackIn(viteConfig))
  })

  it('keeps the CSP script hash in step with the structured-data block', () => {
    // vercel.json hash-pins this one remaining inline script for the CSP.
    // Normalize CRLF -> LF first: git stores this file with LF endings (that's
    // what Vercel builds from), but a Windows checkout may read it back as
    // CRLF, which would hash differently and produce a false failure here.
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(
      html.replace(/\r\n/g, '\n')
    )?.[1]
    expect(ld).toBeTruthy()
    const hash = createHash('sha256').update(ld!, 'utf8').digest('base64')
    expect(vercelConfig).toContain(`sha256-${hash}`)
  })
})

describe('crawler files', () => {
  it('robots.txt advertises the sitemap', () => {
    expect(robots).toMatch(/^Sitemap: \S+$/m)
  })

  it('sitemap.xml agrees with the canonical URL', () => {
    // Catches a half-finished domain replacement across the four files.
    const loc = /<loc>([^<]+)<\/loc>/.exec(sitemap)?.[1]
    expect(loc).toBe(CANONICAL)
    expect(robots).toContain(`Sitemap: ${new URL('sitemap.xml', CANONICAL).href}`)
  })

  it('sitemap.xml lists the info app', () => {
    expect(sitemap).toContain('<loc>https://info.clockflux.app/</loc>')
  })
})
