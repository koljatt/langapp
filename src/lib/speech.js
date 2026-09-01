/** Italian ääntäminen selaimen puhesynteesillä. */

export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

let voice = null;

function pickVoice() {
  if (!canSpeak) return;
  const italian = speechSynthesis.getVoices().filter((v) => /^it/i.test(v.lang));
  voice =
    italian.find((v) => /Alice|Federica|Luca|Elsa|Google|Premium|Enhanced|Natural/i.test(v.name)) ||
    italian[0] ||
    null;
}

if (canSpeak) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

/** Onko koneella lainkaan italiankielistä ääntä. */
export const hasItalianVoice = () => canSpeak && !!voice;

export function say(text, rate = 0.9) {
  if (!canSpeak) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/\?$/, ""));
    u.lang = "it-IT";
    u.rate = rate;
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  } catch (err) {
    console.warn("Puhesynteesi epäonnistui:", err);
  }
}

export function stopSpeaking() {
  if (canSpeak) speechSynthesis.cancel();
}
