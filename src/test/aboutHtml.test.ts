import { describe, it, expect } from 'vitest'
// Vite's ?raw loader, so this needs no node typings.
import indexHtml from '../../index.html?raw'
import aboutHtml from '../../about/index.html?raw'

// about/index.html is a standalone, zero-JS static page that shares its
// marketing copy with the #landing block in index.html (see index.html for
// why that block is static markup rather than React-rendered). It exists so
// the copy has its own crawlable, shareable URL — https://clockflux.app/about/
// — distinct from the app shell. No component test loads this file, so these
// assertions are the only automated cover for it.

function sections(html: string): string[] {
  return [...html.matchAll(/<section class="landing__section[^"]*"[^>]*>[\s\S]*?<\/section>/g)].map(
    (m) => m[0]
  )
}

describe('about/index.html', () => {
  it('does not load the app bundle', () => {
    // The whole point is a lightweight, JS-free page — pulling in React just
    // to show static prose would defeat that.
    expect(aboutHtml).not.toContain('src="/src/main.tsx"')
  })

  it('declares exactly one top-level heading', () => {
    expect(aboutHtml.match(/<h1[\s>]/g)).toHaveLength(1)
  })

  it('carries its own SEO head tags', () => {
    expect(aboutHtml).toMatch(/<meta name="description" content="[^"]{50,}"/)
    expect(aboutHtml).toContain('<link rel="canonical" href="https://clockflux.app/about/" />')
  })

  it('embeds valid WebApplication structured data', () => {
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(aboutHtml)?.[1]
    expect(ld).toBeTruthy()
    const parsed = JSON.parse(ld!)
    expect(parsed['@type']).toBe('WebApplication')
    expect(parsed.featureList.length).toBeGreaterThan(0)
  })

  it('keeps the CSP script hash reused from index.html', () => {
    // Byte-identical to index.html's JSON-LD block, so the hash vercel.json
    // and nginx.conf already pin for that script covers this page too —
    // no CSP config change needed. Normalize CRLF -> LF as indexHtml.test.ts
    // does, for the same reason.
    const norm = (html: string) => html.replace(/\r\n/g, '\n')
    const ldOf = (html: string) => /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(norm(html))?.[1]
    expect(ldOf(aboutHtml)).toBe(ldOf(indexHtml))
  })

  it('has no leftover overlay-dismiss controls', () => {
    // There's no JS on this page to wire a dismiss button up to, so
    // data-landing-dismiss markup here would just be dead weight.
    expect(aboutHtml).not.toContain('data-landing-dismiss')
  })

  it('links its calls to action back to the app', () => {
    const ctas = [...aboutHtml.matchAll(/<a class="landing__cta[^"]*" href="([^"]+)"/g)].map((m) => m[1])
    expect(ctas.length).toBeGreaterThan(0)
    for (const href of ctas) expect(href).toBe('/')
  })

  it('keeps the indexable copy that the page exists for', () => {
    expect(aboutHtml).toMatch(/work hours/i)
    expect(aboutHtml).toMatch(/offline/i)
    expect(aboutHtml).toMatch(/holiday/i)
  })

  it('keeps its marketing sections identical to the in-app landing page', () => {
    // index.html's #landing is the source of truth for this copy (see its own
    // test file). This is the drift guard for the other direction: catches an
    // edit made to one file's sections without the other.
    // Normalize CRLF -> LF: git stores index.html with CRLF line endings, but
    // this file may round-trip through tools that use LF, which would
    // produce a false failure here otherwise.
    const norm = (html: string) => html.replace(/\r\n/g, '\n')
    expect(sections(norm(aboutHtml))).toEqual(sections(norm(indexHtml)))
  })
})
