/**
 * Leitner-tyyppinen kertausväliaikataulu.
 *
 * Kortti istuu laatikossa 0…7. Oikea vastaus nostaa yhden laatikon,
 * väärä pudottaa kaksi (ei nollaan — 600 sanan pakassa täysi nollaus on
 * turhan ankara). Laatikko määrää seuraavan kertausvälin päivinä.
 */

import { CURRICULUM, CARDS } from "../data/index.js";
import { todayKey } from "./text.js";

export const DAY = 86_400_000;
export const INTERVALS = [0, 1, 2, 4, 8, 16, 32, 64]; // päivää, indeksinä laatikko
export const MAX_BOX = INTERVALS.length - 1;
export const KNOWN_BOX = 3; // tästä ylöspäin sana lasketaan osatuksi
export const UNLOCK_RATIO = 0.6; // seuraava jakso aukeaa tällä osuudella

export const boxOf = (state, key) => (state.items[key] ? state.items[key].b : -1);
export const isNew = (state, key) => !state.items[key];
export const isDue = (state, key) => {
  const r = state.items[key];
  return r ? r.due <= Date.now() : false;
};

/** Kirjaa vastauksen ja ajastaa kortin uudelleen. Muokkaa tilaa paikallaan. */
export function grade(state, key, correct) {
  const r = state.items[key] || { b: 0, due: 0, seen: 0, miss: 0 };
  if (correct) {
    r.b = Math.min(MAX_BOX, r.b + 1);
  } else {
    r.b = Math.max(0, r.b - 2);
    r.miss = (r.miss || 0) + 1;
  }
  r.seen = (r.seen || 0) + 1;
  r.due = Date.now() + INTERVALS[r.b] * DAY;
  r.t = Date.now();
  state.items[key] = r;

  const day = todayKey();
  state.log[day] = (state.log[day] || 0) + 1;

  const s = streak(state);
  if (s > (state.best || 0)) state.best = s;
  return r;
}

/** Merkitsee uuden kortin nähdyksi ilman arvosanaa (esittelykortti). */
export function introduce(state, key) {
  state.items[key] = { b: 0, due: Date.now(), seen: 0, miss: 0, t: Date.now() };
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

export function unitStats(state, unit) {
  let known = 0;
  let started = 0;
  let due = 0;
  for (const key of unit.keys) {
    const b = boxOf(state, key);
    if (b >= 0) started++;
    if (b >= KNOWN_BOX) known++;
    if (isDue(state, key)) due++;
  }
  return { known, started, due, total: unit.keys.length, pct: unit.keys.length ? known / unit.keys.length : 0 };
}

/** Kerrattavat avaimet, kiireellisin ensin. */
export function dueKeys(state, pool) {
  const src = pool || CARDS.map((c) => c.key);
  return src.filter((k) => isDue(state, k)).sort((a, b) => state.items[a].due - state.items[b].due);
}

/**
 * Montako jaksoa on auki. Jakso 1 aina; seuraava aukeaa kun edellisestä
 * on osattu UNLOCK_RATIO. Estää sen, että 681 sanaa kaatuu kerralla niskaan.
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
  for (const c of CARDS) {
    const r = state.items[c.key];
    if (!r) continue;
    boxes[r.b]++;
    seenCards++;
    missSum += r.miss || 0;
    seenSum += r.seen || 0;
  }
  const known = boxes.slice(KNOWN_BOX).reduce((a, b) => a + b, 0);
  return {
    boxes,
    seenCards,
    known,
    total: CARDS.length,
    accuracy: seenSum ? Math.round((1 - missSum / seenSum) * 100) : 0,
  };
}
