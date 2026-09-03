/**
 * Minimalistinen service worker: sama-origin GET-pyynnöt verkosta ensin,
 * mutta jokainen onnistunut vastaus tallennetaan ajonaikaiseen välimuistiin
 * — niin sovellus toimii offline heti kun se on kerran auennut. Vite
 * nimeää build-tiedostot sisältötiivisteellä (index-AbC123.js), joten uusi
 * julkaisu ei koskaan törmää vanhaan välimuistiin: nimi on eri, ja vanha
 * jää käyttämättömänä lojumaan kunnes activate-vaiheen siivous poistaa sen.
 */

const CACHE = "parliamo-v1";

/**
 * Google Fonts on eri origin, joten vastaukset ovat läpinäkymättömiä: niitä ei
 * voi lukea, mutta välimuistiin ne kelpaavat. Osoitteet ovat versioituja ja
 * sisältö muuttumatonta, joten välimuisti ensin. Selaimen oma HTTP-välimuisti
 * ei tähän riitä: iOS tyhjentää sen omin päin, ja ilman kirjasimia
 * kotinäytöltä avattu sovellus piirtyisi offline väärällä typografialla.
 */
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

/** Vastaus kulkee läpi sellaisenaan; kopio menee välimuistiin taustalla. */
function keep(request, response) {
  const copy = response.clone();
  caches
    .open(CACHE)
    .then((c) => c.put(request, copy))
    .catch(() => {}); // esim. tila lopussa — ei syy kaataa pyyntöä
  return response;
}

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

  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches
        .match(e.request)
        .then((hit) => hit || fetch(e.request).then((res) => keep(e.request, res))),
    );
    return;
  }

  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => keep(e.request, res))
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match("./index.html"))),
  );
});
