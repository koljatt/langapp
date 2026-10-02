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

/**
 * iOS ei päästä puhesynteesiä käyntiin ennen kuin se on kerran käynnistetty
 * käyttäjän eleen sisällä. Osa korteista lukee sanan itsestään pienen viiveen
 * jälkeen (setTimeout) eli eleen ulkopuolella — kotinäytöltä avatussa
 * sovelluksessa juuri ne jäisivät mykiksi, kunnes käyttäjä sattuisi painamaan
 * kuuntelunappia. Siksi moottori avataan äänettömällä lausumalla heti
 * ensimmäisestä kosketuksesta, tuli se mistä tahansa. Samalla äänet ehtivät
 * ladautua: iOS palauttaa getVoices():n tyhjänä ennen ensimmäistä elettä.
 */
let unlocked = false;
function unlockSpeech() {
  if (unlocked) return;
  unlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch {
    // Ei haittaa: say() yrittää joka tapauksessa normaalisti.
  }
  pickVoice();
}

if (canSpeak) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
  window.addEventListener("pointerdown", unlockSpeech, { once: true, capture: true });
}

/**
 * Kutsutaan käyttäjän eleen (napautus, lähetys) sisällä ennen asynkronista
 * odotusta. iOS sallii ohjelmallisen puheen vain, jos moottori on herätetty
 * juuri äskettäisessä eleessä — kotinäytön sovelluksessa alkuperäinen
 * avaus ei riitä, kun vastaus saapuu vasta verkkokutsun jälkeen.
 */
export function primeSpeech() {
  if (!canSpeak) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch {
    /* ei haittaa */
  }
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
    // iOS jättää moottorin toisinaan paused-tilaan taustalta palattaessa,
    // jolloin uusi lausuma jäisi jonoon soimatta.
    if (speechSynthesis.paused) speechSynthesis.resume();
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

/* ---------- puheentunnistus ---------- */

const Recognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * iOS:n kotinäytöltä avattu sovellus tarjoaa SpeechRecognition-olion, mutta
 * tunnistus jää käynnistyttyään usein jumiin: mikrofoni pysyy päällä eikä
 * tulosta tai lopetusta koskaan tule. Siellä mikrofoni piilotetaan.
 */
const iosStandalone = typeof navigator !== "undefined" && navigator.standalone === true;

/** Selain tukee puheentunnistusta (Chrome, Safari-selain; ei Firefox eikä iOS-kotinäyttö). */
export const canListen = !!Recognition && !iosStandalone;

let current = null;

/** Lopettaa käynnissä olevan kuuntelun; kuultu tulos (jos mitään) palautuu normaalisti. */
export function stopListening() {
  if (current) {
    try {
      current.stop();
    } catch {
      /* jo pysähtynyt */
    }
  }
}

export const isListening = () => !!current;

/**
 * Kuuntelee yhden italiankielisen lausuman ja palauttaa tunnistuksen
 * vaihtoehdot parhaasta alkaen. Hylkää virheellä: "denied" (mikrofoni estetty),
 * "none" (ei puhetta) tai muu selaimen virhekoodi. Pysähtyy itsestään
 * `timeout` millisekunnin jälkeen, ettei mikrofoni jää päälle.
 *
 * iPhonen Safari antaa usein vain välitulokset (isFinal: false) ja lopettaa
 * ilman lopullista tulosta, eikä se myöskään lopeta itse hiljaisuuden
 * tultua. Siksi välitulokset kerätään talteen ja palautetaan, jos lopullista
 * ei tule, ja kuuntelu lopetetaan itse, kun puhetta ei ole kuulunut
 * `silence` millisekuntiin. `onPartial` saa tekstin sitä mukaa kuin sitä
 * kuuluu, jotta käyttäjä näkee mikrofonin toimivan.
 */
export function listenOnce({ timeout = 8000, silence = 1500, onPartial } = {}) {
  return new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error("unsupported"));
    stopListening();
    stopSpeaking(); // ettei tunnistus kuule sovelluksen omaa ääntä
    const rec = new Recognition();
    rec.lang = "it-IT";
    rec.maxAlternatives = 5;
    rec.interimResults = true;
    rec.continuous = false;
    let done = false;
    let heard = [];
    let quiet = null;
    const stop = () => {
      try {
        rec.stop();
      } catch {
        /* ei haittaa */
      }
    };
    const finish = (fn) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(hard);
      clearTimeout(quiet);
      if (current === rec) current = null;
      fn();
    };
    // Kuultu teksti voittaa virheen: lopetus kesken välituloksen ei ole "ei puhetta".
    const settle = (err) => finish(() => (heard.length ? resolve(heard) : reject(err)));
    // Ensin pyydetään siisti lopetus; jos selain ei silti lopeta, pakotetaan.
    const timer = setTimeout(stop, timeout);
    const hard = setTimeout(() => {
      try {
        rec.abort();
      } catch {
        /* ei haittaa */
      }
      settle(new Error("none"));
    }, timeout + 2000);
    rec.onresult = (e) => {
      const results = [...e.results];
      const text = results.map((r) => r[0].transcript).join(" ").replace(/\s+/g, " ").trim();
      if (!text) return;
      heard = results.length === 1 ? [...results[0]].map((a) => a.transcript.trim()) : [text];
      if (results.every((r) => r.isFinal)) return finish(() => resolve(heard));
      if (onPartial) onPartial(text);
      clearTimeout(quiet);
      quiet = setTimeout(stop, silence);
    };
    rec.onerror = (e) =>
      settle(
        new Error(
          e.error === "not-allowed" || e.error === "service-not-allowed"
            ? "denied"
            : e.error === "no-speech" || e.error === "aborted"
              ? "none"
              : e.error,
        ),
      );
    rec.onend = () => settle(new Error("none"));
    try {
      current = rec;
      rec.start();
    } catch (err) {
      finish(() => reject(err));
    }
  });
}
