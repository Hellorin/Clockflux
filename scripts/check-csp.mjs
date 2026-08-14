// Fails the build when the Content-Security-Policy committed in vercel.json /
// nginx.conf does not allow the API origin this bundle is actually being built
// to call.
//
// This exists because of the single worst defect found in the 2026-08-14
// production-readiness audit: `connect-src ... https://XXX` shipped to
// production in four separate files. XXX was an unresolved placeholder, the API
// is a different origin from the app, and so *every* fetch — sign-in, refresh,
// sync, settings, export, billing — was blocked by the browser. Nobody could
// sign in and nobody could pay.
//
// It survived because nothing could catch it: the Vite dev server never applies
// vercel.json headers, so the app works perfectly in dev and fails only once
// deployed. It has to be a build-time check for two more reasons:
//
//   1. Vercel reads vercel.json *before* running the build command, so the CSP
//      cannot be generated from VITE_API_URL at build time — it must be a
//      committed literal, which means it can drift from the env var.
//   2. Whoever changes VITE_API_URL in the Vercel dashboard (a new backend
//      host, a custom domain) will not think to edit a CSP string in a JSON
//      file. This is what tells them.
//
// Skipped when VITE_API_URL is unset or points at localhost, so `npm run build`
// still works for a local production-mode build.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const apiUrl = process.env.VITE_API_URL
if (!apiUrl) {
  console.warn('[check-csp] VITE_API_URL is unset — skipping CSP origin check.')
  process.exit(0)
}

let origin
try {
  origin = new URL(apiUrl).origin
} catch {
  fail(`VITE_API_URL is not a valid URL: ${JSON.stringify(apiUrl)}`)
}

if (new URL(apiUrl).hostname === 'localhost' || new URL(apiUrl).hostname === '127.0.0.1') {
  console.warn(`[check-csp] VITE_API_URL is ${origin} — skipping CSP origin check for a local build.`)
  process.exit(0)
}

// Every file that carries a copy of the policy. nginx.conf holds two (the
// server-level header and the one re-declared inside the /assets/ block,
// because add_header does not inherit once a nested block declares its own).
const sources = ['vercel.json', 'nginx.conf']

const problems = []

for (const file of sources) {
  const text = readFileSync(join(root, file), 'utf8')
  // Matched on the policy body rather than the header name: the two share a
  // line in nginx.conf but are separate JSON fields in vercel.json.
  const policies = [...text.matchAll(/default-src[^"]*/g)].map(m => m[0])

  if (policies.length === 0) {
    problems.push(`${file}: no Content-Security-Policy found`)
    continue
  }

  policies.forEach((policy, i) => {
    const where = policies.length > 1 ? `${file} (policy ${i + 1} of ${policies.length})` : file
    const connectSrc = /connect-src ([^;]*)/.exec(policy)?.[1]

    if (!connectSrc) {
      problems.push(`${where}: policy has no connect-src directive`)
      return
    }
    if (/XXX/.test(policy)) {
      problems.push(`${where}: still contains the unresolved "XXX" placeholder`)
      return
    }
    if (!connectSrc.split(/\s+/).includes(origin)) {
      problems.push(
        `${where}: connect-src does not allow ${origin}\n` +
          `    connect-src is currently: ${connectSrc.trim()}`
      )
    }
  })
}

if (problems.length > 0) {
  fail(
    `The committed CSP does not match VITE_API_URL (${origin}).\n` +
      `Every API call would be blocked by the browser at runtime.\n\n` +
      problems.map(p => `  - ${p}`).join('\n')
  )
}

console.log(`[check-csp] OK — connect-src allows ${origin} in ${sources.join(', ')}.`)

function fail(message) {
  console.error(`\n[check-csp] ${message}\n`)
  process.exit(1)
}
