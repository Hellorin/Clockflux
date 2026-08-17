(function() {
  try {
    var d = JSON.parse(localStorage.getItem('app') || '{}');
    // Built from local date parts, matching getTodayKey() in src/utils/time.ts.
    // toISOString() is UTC, so for anyone west of Greenwich this read the *next*
    // day's key from about 19:00 local onwards, found no session, and painted
    // the dark "resting" theme — then React corrected it a moment later. A
    // visible flash of the wrong theme every evening, and the mirror image for
    // UTC+ users in the early hours.
    var n = new Date();
    var today = n.getFullYear() + '-' +
      String(n.getMonth() + 1).padStart(2, '0') + '-' +
      String(n.getDate()).padStart(2, '0');
    var sessions = (d.days || {})[today] || [];
    var checkedIn = sessions.length > 0 && sessions[sessions.length - 1].checkOut === null;
    document.documentElement.setAttribute('data-theme', checkedIn ? 'light' : 'dark');
  } catch { /* localStorage may be unavailable */ }
  try {
    // Custom theme colors (Pro "themes" feature), applied before first paint
    // to avoid a flash of the default light/dark backgrounds. App.tsx keeps
    // these in sync afterward; this is just the pre-mount seed.
    var s = JSON.parse(localStorage.getItem('appSettings') || '{}');
    // Validated before it reaches setProperty. Everything else that reads
    // these (useAppSettings, and the backend's sanitizeSettings) checks the
    // same 7-char hex shape; this script ran with no check at all, which made
    // it the one place a value could get into the CSSOM unvalidated.
    var isHexColor = function (v) { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v); };
    if (isHexColor(s.themeLightColor)) document.documentElement.style.setProperty('--bg-light-color', s.themeLightColor);
    if (isHexColor(s.themeDarkColor)) document.documentElement.style.setProperty('--bg-dark-color', s.themeDarkColor);
  } catch { /* localStorage may be unavailable */ }
})();
