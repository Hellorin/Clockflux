/* Pre-paint: renames the legacy 'timeforge*' local storage keys (left over
   from the app's name before it became Clockflux) to their current,
   product-name-agnostic equivalents. Runs before theme-init.js and
   landing-init.js — both read the new names directly and rely on this
   having already run.
   Idempotent and cheap enough to run on every load: once a visitor has been
   migrated the old keys are gone, so this is just a handful of null checks
   from then on. */
(function() {
  var RENAMES = [
    ['timeforge', 'app'],
    ['timeforgeSettings', 'appSettings'],
    ['timeforgeVisited', 'appVisited'],
    ['timeforgeUser', 'appUser'],
    ['timeforgeAccessToken', 'appAccessToken']
  ];
  try {
    RENAMES.forEach(function (pair) {
      var oldKey = pair[0];
      var newKey = pair[1];
      var oldValue = localStorage.getItem(oldKey);
      if (oldValue === null) return;
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldValue);
      }
      localStorage.removeItem(oldKey);
    });
  } catch { /* localStorage may be unavailable */ }
})();
