/* Pre-paint: hide the landing page for returning visitors so it never
   flashes. Runs before the stylesheet and before any module.
   'timeforgeVisited' is duplicated from VISIT_STORAGE_KEY in
   src/repositories/localStorageVisitRepository.ts — src/test/indexHtml.test.ts
   asserts the two stay in sync.
   '#privacy' wins over the visited flag: the privacy notice has to stay
   reachable at a stable URL, so a returning visitor following that link
   gets the landing rather than a tracker with nothing on it. Mirrored in
   readInitialOpen() in src/hooks/useLandingPage.ts. */
(function() {
  try {
    if (localStorage.getItem('timeforgeVisited') === '1'
        && location.hash !== '#privacy') {
      document.documentElement.setAttribute('data-landing', 'hidden');
    }
  } catch { /* localStorage may be unavailable */ }
})();
