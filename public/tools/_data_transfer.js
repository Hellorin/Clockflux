var KEYS = ['app', 'appSettings', 'appVisited', 'hoursFormat'];

// Legacy names for keys that used to be prefixed 'timeforge' (the app's name
// before it became Clockflux). The main app migrates these to the KEYS names
// on load (see public/migrate-init.js), but this page can be opened directly
// without that having run yet, and an export made before this rename shipped
// will still have data — or a backup file — under the old names. Read/write
// always prefer the current name; these are only a fallback.
var LEGACY_KEYS = { app: 'timeforge', appSettings: 'timeforgeSettings', appVisited: 'timeforgeVisited' };

function setStatus(message) {
  document.getElementById('status').textContent = message;
}

document.getElementById('exportBtn').addEventListener('click', function () {
  var payload = {};
  KEYS.forEach(function (key) {
    var value = localStorage.getItem(key);
    if (value === null && LEGACY_KEYS[key]) value = localStorage.getItem(LEGACY_KEYS[key]);
    if (value !== null) payload[key] = value;
  });
  if (Object.keys(payload).length === 0) {
    setStatus('Nothing found in local storage on this site — nothing to export.');
    return;
  }
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = 'clockflux-backup-' + stamp + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus('Downloaded. Open this same page on the new site to import it.');
});

var fileInput = document.getElementById('importFile');
var importBtn = document.getElementById('importBtn');

fileInput.addEventListener('change', function () {
  importBtn.disabled = !fileInput.files.length;
});

importBtn.addEventListener('click', function () {
  var file = fileInput.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    var data;
    try {
      data = JSON.parse(String(reader.result));
    } catch {
      setStatus('That file is not valid JSON.');
      return;
    }
    var hasExisting = KEYS.some(function (key) { return localStorage.getItem(key) !== null; });
    if (hasExisting && !confirm('This site already has local data. Importing will overwrite it. Continue?')) {
      setStatus('Import cancelled.');
      return;
    }
    var imported = 0;
    KEYS.forEach(function (key) {
      var value = data[key];
      if (typeof value !== 'string' && LEGACY_KEYS[key]) value = data[LEGACY_KEYS[key]];
      if (typeof value === 'string') {
        localStorage.setItem(key, value);
        imported++;
      }
    });
    setStatus(imported > 0
      ? 'Imported ' + imported + ' item(s). Reload the app to see your data.'
      : 'That file did not contain any recognized Clockflux data.');
  };
  reader.readAsText(file);
});
