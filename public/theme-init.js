(function() {
  try {
    var d = JSON.parse(localStorage.getItem('timeforge') || '{}');
    var today = new Date().toISOString().split('T')[0];
    var sessions = (d.days || {})[today] || [];
    var checkedIn = sessions.length > 0 && sessions[sessions.length - 1].checkOut === null;
    document.documentElement.setAttribute('data-theme', checkedIn ? 'light' : 'dark');
  } catch { /* localStorage may be unavailable */ }
})();
