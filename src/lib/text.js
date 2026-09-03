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

/* ---------- virheanalyysi ---------- */

/**
 * Levenshtein-etäisyys. Sanat ovat lyhyitä, joten suora taulukko riittää;
 * `cap` katkaisee laskennan kun etäisyys on jo isompi kuin mikä kiinnostaa.
 */
export function levenshtein(a, b, cap = 6) {
  a = String(a);
  b = String(b);
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (row[j] < best) best = row[j];
    }
    if (best > cap) return cap + 1;
    prev = row;
  }
  return prev[b.length];
}

/** "pizza" -> "piza". Kaksoiskonsonantti on suomalaisen tyypillinen kompastuskivi. */
export const degeminate = (s) => String(s).replace(/([bcdfglmnprstvz])\1+/g, "$1");

/** Yhteisen alun pituus. */
const shared = (a, b) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

/**
 * Oikea vastaus, mutta aksentit pielessä ("caffe" kun oikein on "caffè").
 * Vastaus hyväksytään silti — tämä on vain hiljainen muistutus.
 * Palauttaa oikein kirjoitetun muodon tai null.
 */
export function accentSlip(got, expected) {
  const g = String(got).trim();
  if (!g) return null;
  for (const e of [].concat(expected)) {
    const raw = String(e);
    if (norm(g) !== norm(raw)) continue;
    if (!/[\u0300-\u036f]/.test(String(raw).normalize("NFD"))) continue; // ei aksentteja
    if (stripAccents(g).toLowerCase() !== g.toLowerCase()) continue; // aksentit kirjoitettu
    return raw;
  }
  return null;
}

/** Virhelajien suomenkieliset nimet — tilastonäkymä lukee tästä. */
export const MISS_LABELS = {
  lipsahdus: "Näppäilylipsahdus", // ei classifyMiss():stä vaan isTypo():sta
  tyhja: "Ei vastausta",
  tupla: "Kaksoiskonsonantti",
  paate: "Sanan pääte",
  artikkeli: "Artikkeli",
  kirjoitus: "Kirjoitusvirhe",
  sekaannus: "Meni sekaisin toiseen sanaan",
  eisana: "Sana ei tullut mieleen",
};

/**
 * Mikä vastauksessa meni pieleen. Vertaa lähimpään hyväksyttyyn muotoon ja
 * palauttaa tunnisteen MISS_LABELS-avaimista. Tunnistaa erikseen ne virheet,
 * joita italiaa opetteleva suomenkielinen tekee toistuvasti.
 */
export function classifyMiss(got, expected) {
  const g = norm(got);
  if (!g) return "tyhja";

  let best = "";
  let dist = Infinity;
  for (const e of [].concat(expected)) {
    const n = norm(e);
    const d = levenshtein(g, n);
    if (d < dist) {
      dist = d;
      best = n;
    }
  }
  if (!best || dist === 0) return "kirjoitus";

  if (degeminate(g) === degeminate(best)) return "tupla";
  if (norm(dropArticle(g)) === norm(dropArticle(best))) return "artikkeli";

  const stem = shared(g, best);
  if (stem >= 3 && best.length - stem <= 2 && g.length - stem <= 2) return "paate";
  if (dist <= 2 && best.length >= 4) return "kirjoitus";
  if (dist === 1) return "kirjoitus";
  return "eisana";
}

/**
 * Yhden kirjaimen lipsahdus pidemmässä sanassa. Ei pudoteta laatikkoa —
 * näppäilyvirhe ei ole sama asia kuin unohtunut sana, ja jos se laskettaisiin
 * virheeksi, tilasto "mitä et osaa" menisi pilalle.
 */
export function isTypo(got, expected) {
  const g = norm(got);
  if (!g) return false;
  return [].concat(expected).some((e) => {
    const n = norm(e);
    return n.length >= 5 && levenshtein(g, n, 1) === 1 && degeminate(g) !== degeminate(n);
  });
}

/* ---------- suku (il/la) ---------- */

const GENDER_ARTICLE = [
  [/^il\s+/i, "m"],
  [/^lo\s+/i, "m"],
  [/^uno\s+/i, "m"],
  [/^un\s+/i, "m"],
  [/^la\s+/i, "f"],
  [/^una\s+/i, "f"],
  [/^un['’]/i, "f"],
];

/**
 * Päättelee suvun kortin omasta yksiköllisestä artikkelista — ei arvausta,
 * vain sitä mitä data jo kertoo. Monikkoartikkelit (i/gli/le) jätetään
 * tietoisesti pois: il/la-harjoitus kysyy nimenomaan yksikön artikkelia,
 * eikä "i pantaloni" -tyyppisistä vain monikossa esiintyvistä sanoista voi
 * sitä johtaa. "l'" jää myös aina pois: elisio piilottaa suvun (l'amico on
 * maskuliini, l'amica feminiini), eikä sitä voi päätellä ilman erillistä
 * sanakirjaa. Samoin karsiutuvat idiomit ja määrälausekkeet, joissa
 * artikkelin jälkeinen osa ei ole siisti substantiivilauseke: pilkulla
 * jatkuva ("il conto, per favore"), di:hin päättyvä ("un chilo di") tai
 * heittomerkkiin typistyvä ("un po'").
 */
export function genderOf(card) {
  const s = String(card.it);
  for (const [re, g] of GENDER_ARTICLE) {
    const m = s.match(re);
    if (!m) continue;
    const rest = s.slice(m[0].length).trim();
    if (!rest || rest.includes(",") || /\bdi$/i.test(rest) || /'$/.test(rest)) return null;
    return g;
  }
  return null;
}
