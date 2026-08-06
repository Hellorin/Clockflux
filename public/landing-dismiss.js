/* The dismiss controls above are painted before React mounts, so latch a
   click here and hide the landing immediately. Recording the visit stays
   in useLandingPage — this only captures the intent. */
window.__clockfluxLandingDismissed = false;
document.addEventListener('click', function(e) {
  if (e.target && e.target.closest && e.target.closest('[data-landing-dismiss]')) {
    window.__clockfluxLandingDismissed = true;
    document.documentElement.setAttribute('data-landing', 'hidden');
  }
}, true);
