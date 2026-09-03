/**
 * Leitner-tyyppinen kertausväliaikataulu, joka mukautuu.
 *
 * Kortti istuu laatikossa 0…7. Oikea vastaus nostaa yhden laatikon,
 * väärä pudottaa kaksi (ei nollaan — 600 sanan pakassa täysi nollaus on
 * turhan ankara). Laatikko määrää kertausvälin päivinä.
 *
 * Sen lisäksi jokaisella kortilla on oma helppouskerroin `e` (0.4…1), joka
 * kertoo laatikon välin. Sana jota kompastelet toistuvasti palaa siis
 * kertaukseen aiemmin kuin saman laatikon sana joka on mennyt kerralla
 * oikein. Kerroin ei nouse yli ykkösen: helppo sana käyttäytyy täsmälleen
 * kuten ennenkin, vaikea tiivistyy.
 */

import { CURRICULUM, CARDS } from "../data/index.js";
import { todayKey } from "./text.js";

export const DAY = 86_400_000;
export const INTERVALS = [0, 1, 2, 4, 8, 16, 32, 64]; // päivää, indeksinä laatikko
export const MAX_BOX = INTERVALS.length - 1;
export const KNOWN_BOX = 3; // tästä ylöspäin sana lasketaan osatuksi
export const UNLOCK_RATIO = 0.6; // seuraava jakso aukeaa tällä osuudella

export const EASE_MAX = 1; // helppoja ei palkita pidemmillä väleillä, vaikeita vain tiivistetään
export const EASE_MIN = 0.4;
export const EASE_DOWN = 0.15; // väärä vastaus
export const EASE_UP = 0.05; // oikea vastaus palauttaa kertoimen hitaasti
export const RECENT = 12; // montako viimeisintä vastausta kortilta muistetaan
export const LEECH_LAPSES = 3; // näin monta romahdusta osatusta -> kompastuskivi
export const STRUGGLE = 0.25; // difficulty() tästä ylöspäin lasketaan vaikeaksi
// Vastaa suunnilleen sitä, että joka kolmas viime vastauksista on mennyt väärin.

/** Uuden kortin tyhjä kirjanpito. */
const blank = () => ({ b: 0, due: 0, seen: 0, miss: 0, e: EASE_MAX, h: "", lp: 0 });

/** Vanhat tallennukset eivät tunne kerrointa eivätkä historiaa. */
function fill(r) {
  if (r.e == null) r.e = EASE_MAX;
  if (r.h == null) r.h = "";
  if (r.lp == null) r.lp = 0;
  return r;
}

export const boxOf = (state, key) => (state.items[key] ? state.items[key].b : -1);
export const isNew = (state, key) => !state.items[key];
export const isDue = (state, key) => {
  const r = state.items[key];
  return r ? r.due <= Date.now() : false;
};

const pushHist = (h, ok) => (String(h || "") + (ok ? "1" : "0")).slice(-RECENT);

/** Laskuri ylös tilaston polkuun. Puuttuvat tasot syntyvät matkalla. */
function bump(state, group, name, ok) {
  if (!name) return;
  const g = (state.stats[group] = state.stats[group] || {});
  if (ok == null) {
    g[name] = (g[name] || 0) + 1;
    return;
  }
  const c = (g[name] = g[name] || { n: 0, ok: 0 });
  c.n++;
  if (ok) c.ok++;
}

/**
 * Kirjaa vastauksen ja ajastaa kortin uudelleen. Muokkaa tilaa paikallaan.
 *
 * `correct` on `true`, `false` tai `"near"` — viimeinen tarkoittaa yhden
 * kirjaimen lipsahdusta: laatikko jää paikalleen, mutta kortti palaa saman
 * session lopussa. Näppäilyvirhe ei ole unohtunut sana.
 *
 * `info` kertoo missä muodossa kysyttiin: `{ mode, dir, err }`. Näistä
 * kertyy kuva siitä, minkä tyyppisissä tehtävissä kompastelee.
 */
export function grade(state, key, correct, info = {}) {
  const r = fill(state.items[key] || blank());
  const ok = correct === true;
  const near = correct === "near";
  state.stats = state.stats || {};

  if (ok) {
    r.b = Math.min(MAX_BOX, r.b + 1);
    r.e = Math.min(EASE_MAX, r.e + EASE_UP);
  } else if (near) {
    r.e = Math.max(EASE_MIN, r.e - EASE_DOWN / 2); // laatikko jää, väli tiivistyy
  } else {
    if (r.b >= KNOWN_BOX) r.lp++; // osatusta takaisin alas = romahdus
    r.b = Math.max(0, r.b - 2);
    r.e = Math.max(EASE_MIN, r.e - EASE_DOWN);
    r.miss = (r.miss || 0) + 1;
  }
  if (!near) r.h = pushHist(r.h, ok);
  r.seen = (r.seen || 0) + 1;
  r.due = Date.now() + Math.round(INTERVALS[r.b] * r.e) * DAY;
  r.t = Date.now();
  state.items[key] = r;

  bump(state, "modes", info.mode, ok);
  bump(state, "dirs", info.dir, ok);
  if (!ok && !near && info.err) bump(state, "errs", info.err, null);
  if (near) bump(state, "errs", "lipsahdus", null);

  const day = todayKey();
  state.log[day] = (state.log[day] || 0) + 1;

  const s = streak(state);
  if (s > (state.best || 0)) state.best = s;
  return r;
}

/** Merkitsee uuden kortin nähdyksi ilman arvosanaa (esittelykortti). */
export function introduce(state, key) {
  state.items[key] = { ...blank(), due: Date.now(), t: Date.now() };
}

/** Peräkkäisten harjoittelupäivien määrä. */
export function streak(state) {
  const d = new Date();
  if (!state.log[todayKey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (state.log[todayKey(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/* ---------- mikä tuottaa vaikeuksia ---------- */

/**
 * Kortin vaikeus 0…1. Painottaa tuoreita virheitä enemmän kuin koko
 * historiaa: sana jonka opit kuukausi sitten kantapään kautta ei ole enää
 * kompastuskivi, mutta sana joka putoaa yhä uudelleen on.
 */
export function difficulty(state, key) {
  const r = state.items[key];
  if (!r || !r.seen) return 0;
  const h = String(r.h || "");
  const recent = h ? [...h].filter((c) => c === "0").length / h.length : 0;
  const lifetime = (r.miss || 0) / r.seen;
  const lapses = Math.min(1, (r.lp || 0) / LEECH_LAPSES);
  const ease = (EASE_MAX - (r.e == null ? EASE_MAX : r.e)) / (EASE_MAX - EASE_MIN);
  return Math.min(1, 0.5 * recent + 0.2 * lifetime + 0.15 * lapses + 0.15 * ease);
}

/** Onko kortti kompastuskivi — riittävästi yrityksiä ja yhä vaikea. */
export const isStruggling = (state, key) => {
  const r = state.items[key];
  return !!r && r.seen >= 2 && (r.miss || 0) >= 1 && difficulty(state, key) >= STRUGGLE;
};

/** Kompastuskivet vaikeimmasta alkaen. */
export function hardKeys(state, pool, limit = Infinity) {
  const src = pool || CARDS.map((c) => c.key);
  return src
    .filter((k) => isStruggling(state, k))
    .sort((a, b) => difficulty(state, b) - difficulty(state, a))
    .slice(0, limit);
}

export function unitStats(state, unit) {
  let known = 0;
  let started = 0;
  let due = 0;
  let hard = 0;
  for (const key of unit.keys) {
    const b = boxOf(state, key);
    if (b >= 0) started++;
    if (b >= KNOWN_BOX) known++;
    if (isDue(state, key)) due++;
    if (isStruggling(state, key)) hard++;
  }
  return {
    known,
    started,
    due,
    hard,
    total: unit.keys.length,
    pct: unit.keys.length ? known / unit.keys.length : 0,
  };
}

/**
 * Yhteenveto siitä, missä harjoittelu takkuaa: vaikeimmat sanat, heikoimmat
 * jaksot, harjoitustavat ja kysymyssuunnat. Tilastonäkymä piirtää tämän.
 */
export function weakSpots(state, limit = 8) {
  const st = state.stats || {};
  const rate = (c) => (c && c.n ? c.ok / c.n : 0);

  const units = CURRICULUM.map((u, i) => ({ i, unit: u, ...unitStats(state, u) }))
    .filter((x) => x.started >= 3 && x.hard > 0)
    .sort((a, b) => b.hard / b.total - a.hard / a.total);

  return {
    cards: hardKeys(state, null, limit),
    units: units.slice(0, 3),
    modes: Object.entries(st.modes || {})
      .map(([k, c]) => ({ k, n: c.n, pct: rate(c) }))
      .filter((x) => x.n >= 5)
      .sort((a, b) => a.pct - b.pct),
    dirs: Object.entries(st.dirs || {})
      .map(([k, c]) => ({ k, n: c.n, pct: rate(c) }))
      .filter((x) => x.n >= 5)
      .sort((a, b) => a.pct - b.pct),
    errs: Object.entries(st.errs || {})
      .map(([k, n]) => ({ k, n }))
      .sort((a, b) => b.n - a.n),
  };
}

/** Kerrattavat avaimet, kiireellisin ensin. */
export function dueKeys(state, pool) {
  const src = pool || CARDS.map((c) => c.key);
  return src.filter((k) => isDue(state, k)).sort((a, b) => state.items[a].due - state.items[b].due);
}

/**
 * Montako jaksoa on auki. Jakso 1 aina; seuraava aukeaa kun edellisestä
 * on osattu UNLOCK_RATIO. Estää sen, että 671 sanaa kaatuu kerralla niskaan.
 */
export function openCount(state) {
  let n = 1;
  for (let i = 0; i < CURRICULUM.length; i++) {
    if (unitStats(state, CURRICULUM[i]).pct >= UNLOCK_RATIO) n = i + 2;
    else break;
  }
  return Math.min(n, CURRICULUM.length);
}

export function overview(state) {
  const boxes = new Array(INTERVALS.length).fill(0);
  let seenCards = 0;
  let missSum = 0;
  let seenSum = 0;
  let hard = 0;
  for (const c of CARDS) {
    const r = state.items[c.key];
    if (!r) continue;
    boxes[r.b]++;
    seenCards++;
    missSum += r.miss || 0;
    seenSum += r.seen || 0;
    if (isStruggling(state, c.key)) hard++;
  }
  const known = boxes.slice(KNOWN_BOX).reduce((a, b) => a + b, 0);
  return {
    boxes,
    seenCards,
    known,
    hard,
    total: CARDS.length,
    accuracy: seenSum ? Math.round((1 - missSum / seenSum) * 100) : 0,
  };
}
