/**
 * Minimalistinen service worker: sama-origin GET-pyynnöt verkosta ensin,
 * mutta jokainen onnistunut vastaus tallennetaan ajonaikaiseen välimuistiin
 * — niin sovellus toimii offline heti kun se on kerran auennut. Vite
 * nimeää build-tiedostot sisältötiivisteellä (index-AbC123.js), joten uusi
 * julkaisu ei koskaan törmää vanhaan välimuistiin: nimi on eri, ja vanha
 * jää käyttämättömänä lojumaan kunnes activate-vaiheen siivous poistaa sen.
 */

const CACHE = "parliamo-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // esim. Google Fonts — selaimen oma cache riittää

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match("./index.html"))),
  );
});
