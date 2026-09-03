/** Italian ääntäminen selaimen puhesynteesillä. */

import { app } from "../app.js";

export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

let voice = null;
let onReady = [];

/** "it", "it-IT", "it_CH" — italiaa. "ita-something" tai muu kieli ei. */
const isItalian = (v) => /^it(?:[-_]|$)/i.test(v.lang);

/**
 * Äänen paremmuus, isompi voittaa. Alue painaa nimeä enemmän: it-CH
 * (sveitsinitalia) ääntää mm. avoimet vokaalit ja soinnillisen s:n eri tavalla
 * kuin se yleisitalia, jota tämä kurssi opettaa, joten it-IT on aina parempi
 * valinta vaikka toisen äänen nimi lupaisi laatua. Nimilista tunnistaa
 * käyttöjärjestelmien italiankieliset laatuäänet vanhoista formanttiäänistä.
 */
const rank = (v) =>
  (/^it[-_]IT$/i.test(v.lang) ? 2 : 0) +
  (/Alice|Federica|Luca|Elsa|Google|Premium|Enhanced|Natural/i.test(v.name) ? 1 : 0);

/**
 * Valitsee äänen. Käyttäjän oma valinta (settings.voiceName) voittaa aina —
 * ilman sitä käyttöjärjestelmän palauttamien äänten järjestys voi vaihtua
 * päivityksessä, jolloin sovellus alkaisi yllättäen käyttää eri ääntä.
 * Siksi paras ääni valitaan pisteyttämällä eikä listan järjestyksestä.
 */
function pickVoice() {
  if (!canSpeak) return;
  const italian = speechSynthesis.getVoices().filter(isItalian);
  const preferred = app.state?.settings?.voiceName;
  const best = italian.reduce((a, b) => (a && rank(a) >= rank(b) ? a : b), null);
  voice = (preferred && italian.find((v) => v.name === preferred)) || best || null;
  if (italian.length) {
    const cbs = onReady;
    onReady = [];
    cbs.forEach((cb) => cb());
  }
}

if (canSpeak) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

/** Onko koneella lainkaan italiankielistä ääntä. */
export const hasItalianVoice = () => canSpeak && !!voice;

/** Kaikki koneelta löytyvät italiankieliset äänet, asetusvalikkoa varten. */
export function listItalianVoices() {
  if (!canSpeak) return [];
  return speechSynthesis
    .getVoices()
    .filter(isItalian)
    .map((v) => ({ name: v.name, lang: v.lang }));
}

/**
 * Kutsuu cb:n kerran, kun italiankieliset äänet saapuvat — ei lainkaan, jos ne
 * ovat jo tallella. Näkymät käyttävät tätä uudelleenpiirtoon, joten
 * synkroninen kutsu olisi ikuinen silmukka (render → cb → render).
 */
export function onVoicesArrive(cb) {
  if (!canSpeak || listItalianVoices().length) return;
  onReady.push(cb);
}

/** Kutsutaan kun käyttäjä vaihtaa äänen asetuksista — valinta on jo tallennettu app.state:en. */
export function refreshVoice() {
  pickVoice();
}

/**
 * Lukee tekstin italiaksi. Vaatii italiankielisen äänen: ilman sitä selain
 * lukisi sanan järjestelmän oletusäänellä eli suomen tai englannin
 * äänteistöllä ("grazie" → "gratsii"), ja väärin kuultu sana jää mieleen
 * väärin. Hiljaisuus on kielenoppijalle parempi kuin väärä ääntämys —
 * asetusnäkymä kertoo, mistä äänen saa asennettua.
 *
 * Kysymysmerkki jätetään paikalleen: se on se, mistä puhesyntetisaattori
 * päättelee kysymyksen nousevan intonaation ("Come stai?").
 */
export function say(text, rate = 0.9) {
  if (!canSpeak) return;
  if (!voice) pickVoice(); // äänet voivat valmistua vasta moduulin latauksen jälkeen
  if (!voice) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).trim());
    u.voice = voice;
    // Sama alue kuin äänellä: ristiriitaisella lang-arvolla osa selaimista
    // hylkää valitun äänen ja korvaa sen omalla oletuksellaan.
    u.lang = voice.lang;
    u.rate = rate;
    speechSynthesis.speak(u);
  } catch (err) {
    console.warn("Puhesynteesi epäonnistui:", err);
  }
}

export function stopSpeaking() {
  if (canSpeak) speechSynthesis.cancel();
}
