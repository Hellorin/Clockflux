(function() {
  try {
    var d = JSON.parse(localStorage.getItem('app') || '{}');
    var today = new Date().toISOString().split('T')[0];
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
