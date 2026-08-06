import { describe, it, expect } from 'vitest'
import { VISIT_STORAGE_KEY } from '../repositories/localStorageVisitRepository'
import { STORAGE_KEY as TIME_ENTRIES_STORAGE_KEY } from '../repositories/localStorageTimeEntriesRepository'
import { STORAGE_KEY as SETTINGS_STORAGE_KEY } from '../repositories/localStorageSettingsRepository'
import { STORAGE_KEY as PREFERENCES_STORAGE_KEY } from '../repositories/localStoragePreferencesRepository'
// Vite's ?raw loader, so this needs no node typings.
import html from '../../index.html?raw'
import robots from '../../public/robots.txt?raw'
import sitemap from '../../public/sitemap.xml?raw'

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
    expect(html).toContain(`localStorage.getItem('${VISIT_STORAGE_KEY}')`)
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

  it('carries a privacy notice the footer links to', () => {
    expect(html).toContain('id="privacy"')
    expect(html).toContain('href="#privacy"')
  })

  it('names every storage key the app writes', () => {
    // Imported rather than spelled out, so renaming a key fails here instead of
    // leaving the notice quietly describing storage that no longer exists.
    for (const key of [
      TIME_ENTRIES_STORAGE_KEY,
      SETTINGS_STORAGE_KEY,
      PREFERENCES_STORAGE_KEY,
      VISIT_STORAGE_KEY,
    ]) {
      expect(html).toContain(`<code>${key}</code>`)
    }
  })

  it('discloses the analytics and the absence of cookies', () => {
    // The one thing on the page that talks to a third party — GDPR Art. 13 is
    // why the notice exists at all.
    expect(html).toMatch(/Vercel Web Analytics/)
    expect(html).toMatch(/sets no cookies/i)
  })

  it('keeps the pre-paint script in step with the privacy deep link', () => {
    // Mirrors isPrivacyDeepLink() in src/hooks/useLandingPage.ts. If the script
    // hides the landing regardless of the hash, the notice becomes unreachable
    // for everyone who has already used the app.
    expect(html).toMatch(/location\.hash !== '#privacy'/)
  })

  it('keeps the indexable copy that the page exists for', () => {
    expect(html).toMatch(/work hours/i)
    expect(html).toMatch(/offline/i)
    expect(html).toMatch(/holiday/i)
  })
})

describe('crawler files', () => {
  it('robots.txt advertises the sitemap', () => {
    expect(robots).toMatch(/^Sitemap: \S+$/m)
    expect(robots).toContain('Disallow: /_icon_render.html')
  })

  it('sitemap.xml agrees with the canonical URL', () => {
    // Catches a half-finished domain replacement across the four files.
    const loc = /<loc>([^<]+)<\/loc>/.exec(sitemap)?.[1]
    expect(loc).toBe(CANONICAL)
    expect(robots).toContain(`Sitemap: ${new URL('sitemap.xml', CANONICAL).href}`)
  })
})
