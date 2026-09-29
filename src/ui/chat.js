import { app, el } from "../app.js";
import { ai, SCENARIOS } from "../lib/ai.js";
import { escapeHtml } from "../lib/text.js";
import { canListen, hasItalianVoice, isListening, listenOnce, say, stopListening } from "../lib/speech.js";
import { MIC, SPEAKER } from "./icons.js";

/** Nykyinen keskustelu; tyhjä = skenaarion valinta. Ei tallenneta. */
let scenario = null;
let turns = []; // { role: "user"|"model", text, fi?, fix? }
let busy = false;

function pick() {
  let h = '<div class="hero"><div><span class="eyebrow">Keskustelu</span><h2>Jutustele italiaksi</h2></div>';
  h += '<p class="sub">Tekoäly esittää roolihahmoa yksinkertaisella italialla ja korjaa virheesi. Vaatii verkkoyhteyden.</p></div>';
  h += '<div class="units">';
  for (const [id, title, sub] of SCENARIOS) {
    h += `<button class="unit" data-scn="${id}"><span class="idx">💬</span><span><span class="tt">${escapeHtml(title)}</span><br><span class="it">${escapeHtml(sub)}</span></span></button>`;
  }
  h += "</div>";
  el("vChat").innerHTML = h;
  el("vChat").querySelectorAll("[data-scn]").forEach((b) =>
    b.addEventListener("click", () => {
      scenario = b.dataset.scn;
      turns = [];
      renderChat();
      send(null); // hahmo aloittaa
    }),
  );
}

function bubble(t) {
  if (t.role === "user") {
    return `<div class="bub me">${escapeHtml(t.text)}${t.fix ? `<div class="fix">${escapeHtml(t.fix)}</div>` : ""}</div>`;
  }
  const spk = hasItalianVoice()
    ? `<button class="speakbtn small" data-say="${escapeHtml(t.text)}" aria-label="Kuuntele">${SPEAKER(16)} Kuuntele</button>`
    : "";
  return `<div class="bub them"><div>${escapeHtml(t.text)}</div>${spk}${t.fi ? `<div class="fi" hidden>${escapeHtml(t.fi)}</div><button class="tr" data-tr>Näytä suomeksi</button>` : ""}</div>`;
}

function renderChat() {
  const title = SCENARIOS.find((s) => s[0] === scenario)?.[1] || "";
  let h = `<div class="chathead"><button class="back" data-back>&larr; Skenaariot</button><span class="eyebrow">${escapeHtml(title)}</span></div>`;
  if (!hasItalianVoice()) {
    h += '<p class="sub" style="color:var(--muted);font-size:.85rem">Italiankielistä ääntä ei löytynyt, joten ääntä ei kuulu. iPhonessa: Asetukset → Helppokäyttöisyys → Puhuttu sisältö → Äänet → Italia.</p>';
  }
  h += `<div class="chatlog">${turns.map(bubble).join("")}${busy ? '<div class="bub them dim">…</div>' : ""}</div>`;
  // Kenttää ei koskaan poisteta käytöstä: iOS piirtää disabled-kentän lähes
  // näkymättömäksi, ja kirjoittaa voi jo sillä aikaa kun vastausta odotetaan.
  h += `<form class="chatin">
    <input class="typed" type="text" name="m" enterkeyhint="send" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="off" placeholder="Kirjoita italiaksi…">
    <div class="chatbtns">
      ${canListen ? `<button type="button" class="speakbtn" data-mic aria-label="Sano ääneen">${MIC(18)} <span>Puhu</span></button>` : ""}
      <button class="btn">${busy ? "Odotetaan…" : "Lähetä"}</button>
    </div>
  </form><div class="micres" data-err aria-live="polite"></div>`;
  const host = el("vChat");
  const draft = host.querySelector('input[name="m"]')?.value || "";
  host.innerHTML = h;
  host.querySelector('input[name="m"]').value = draft;

  host.querySelector("[data-back]").addEventListener("click", () => {
    stopListening();
    scenario = null;
    pick();
  });
  host.querySelectorAll("[data-say]").forEach((b) => b.addEventListener("click", () => say(b.dataset.say)));
  host.querySelectorAll("[data-tr]").forEach((b) =>
    b.addEventListener("click", () => {
      b.previousElementSibling.hidden = false;
      b.remove();
    }),
  );
  const form = host.querySelector("form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = form.m.value.trim();
    const err = host.querySelector("[data-err]");
    if (busy) {
      err.className = "micres";
      err.textContent = "Odota vastausta ennen seuraavaa viestiä.";
    } else if (!v) {
      form.m.focus();
    } else {
      send(v);
    }
  });
  const mic = host.querySelector("[data-mic]");
  if (mic) {
    const label = mic.querySelector("span");
    mic.addEventListener("click", async () => {
      // Toinen napautus lopettaa kuuntelun.
      if (isListening()) return stopListening();
      mic.classList.add("rec");
      label.textContent = "Lopeta";
      try {
        form.m.value = (await listenOnce())[0];
      } catch {
        /* ei puhetta — ei haittaa */
      }
      mic.classList.remove("rec");
      label.textContent = "Puhu";
    });
  }
  const log = host.querySelector(".chatlog");
  log.scrollTop = log.scrollHeight;
  window.scrollTo(0, document.body.scrollHeight);
}

async function send(text) {
  const mine = text ? { role: "user", text } : null;
  if (mine) turns.push(mine);
  busy = true;
  renderChat();
  if (mine) el("vChat").querySelector('input[name="m"]').value = "";
  try {
    const r = await ai("roleplay", { scenario, messages: turns.map(({ role, text }) => ({ role, text })) });
    if (mine && r.fix) mine.fix = r.fix;
    turns.push({ role: "model", text: r.reply, fi: r.fi });
    busy = false;
    renderChat();
  } catch (err) {
    busy = false;
    renderChat();
    el("vChat").querySelector("[data-err]").textContent = err.message;
    el("vChat").querySelector("[data-err]").className = "micres no";
    if (mine) {
      turns.pop(); // viesti ei mennyt perille — palautetaan kenttään
      el("vChat").querySelector('input[name="m"]').value = text;
    }
  }
}

export function renderChatView() {
  if (scenario) renderChat();
  else pick();
}
