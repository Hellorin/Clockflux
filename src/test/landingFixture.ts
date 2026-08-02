// A minimal stand-in for the landing markup that lives in index.html. It
// deliberately contains only the tokens useLandingPage depends on — the id, the
// dismiss hook and the focus target — and none of the marketing copy, so tests
// break when the *contract* changes rather than when the copy is reworded.
// src/test/indexHtml.test.ts is what checks the real markup still provides them.
export const LANDING_FIXTURE_HTML = `
  <div id="landing" class="landing" role="region" tabindex="-1">
    <button type="button" id="landing-cta" data-landing-dismiss>Start tracking</button>
  </div>
`

export function mountLandingFixture(): HTMLElement {
  document.body.insertAdjacentHTML('afterbegin', LANDING_FIXTURE_HTML)
  return document.getElementById('landing')!
}

export function unmountLandingFixture(): void {
  document.getElementById('landing')?.remove()
}
