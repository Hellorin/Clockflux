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
    if (s.themeLightColor) document.documentElement.style.setProperty('--bg-light-color', s.themeLightColor);
    if (s.themeDarkColor) document.documentElement.style.setProperty('--bg-dark-color', s.themeDarkColor);
  } catch { /* localStorage may be unavailable */ }
})();
