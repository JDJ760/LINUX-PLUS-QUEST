// SERVICE WORKER — a script the browser runs in the background, separate from
// the page. It sits between the app and the network and can answer requests
// from a saved copy (the "cache"), which is what makes the app work offline.
//
// Strategy: NETWORK FIRST.
//   online  -> fetch the newest file, save a copy, return it
//   offline -> return the saved copy
// The old strategy was "cache first", which served the saved copy forever and
// only updated if someone remembered to rename CACHE below. Network-first means
// a normal reload always gets the newest version with no manual step.
const CACHE = "techquest-v13";
// Files saved at install time so the very first offline launch works.
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()))
);

// On activation, delete caches left behind by older versions.
self.addEventListener("activate", e =>
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()))
);

self.addEventListener("fetch", e => {
  const req = e.request;
  // Only handle plain reads of our own files; let anything else pass through.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone(); // a response body can be read once, so save a clone
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() =>
      // Offline: saved copy of this file, or the app shell as a last resort.
      caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("./index.html"))
    )
  );
});
