/** Merkkijonojen normalisointi vastausten vertailua varten. */

const COMBINING = /[\u0300-\u036f]/g;
const ARTICLE = /^(il |lo |la |i |gli |le |l'|un |uno |una |un')/;

/** Poistaa aksentit: "caffè" -> "caffe". */
export const stripAccents = (s) => String(s).normalize("NFD").replace(COMBINING, "");

/** Vertailumuoto: pienet kirjaimet, ei aksentteja, ei välimerkkejä. */
export const norm = (s) =>
  stripAccents(s)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** "il caffè" -> "caffè". Artikkeli saa jäädä vastauksesta pois. */
export const dropArticle = (s) => String(s).replace(ARTICLE, "");

/** Kaikki hyväksytyt italiankieliset kirjoitusasut yhdelle kortille. */
export const acceptedForms = (card) =>
  new Set([norm(card.it), norm(dropArticle(card.it))]);

/**
 * Suomen käännös voi olla "setä, eno" — kumpi tahansa kelpaa, samoin koko
 * merkkijono. Erottimet pilkotaan ennen normalisointia, koska norm() poistaa
 * välimerkit.
 */
export const finnishForms = (card) => {
  const parts = String(card.fi)
    .split(/[,;/]|\s+tai\s+/)
    .map((s) => norm(s))
    .filter(Boolean);
  return new Set([...parts, norm(card.fi)]);
};

export const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const todayKey = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
