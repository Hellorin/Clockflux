var KEYS = ['timeforge', 'timeforgeSettings', 'timeforgeVisited', 'hoursFormat'];

function setStatus(message) {
  document.getElementById('status').textContent = message;
}

document.getElementById('exportBtn').addEventListener('click', function () {
  var payload = {};
  KEYS.forEach(function (key) {
    var value = localStorage.getItem(key);
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
    } catch (e) {
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
      if (typeof data[key] === 'string') {
        localStorage.setItem(key, data[key]);
        imported++;
      }
    });
    setStatus(imported > 0
      ? 'Imported ' + imported + ' item(s). Reload the app to see your data.'
      : 'That file did not contain any recognized Clockflux data.');
  };
  reader.readAsText(file);
});
