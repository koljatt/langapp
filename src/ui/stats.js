import { app, el } from "../app.js";
import { BY_KEY } from "../data/index.js";
import { difficulty, overview, streak, weakSpots, INTERVALS, KNOWN_BOX } from "../lib/srs.js";
import { escapeHtml, todayKey, MISS_LABELS } from "../lib/text.js";
import { canSpeak, hasItalianVoice, listItalianVoices, onVoicesArrive, refreshVoice, say } from "../lib/speech.js";
import { startSession } from "./drill.js";
import { SPEAKER } from "./icons.js";
import * as store from "../lib/store.js";

const MODES = [
  ["choice", "Monivalinta", "Nopea tunnistus, uusille sanoille"],
  ["type", "Kirjoitus", "Aktiivinen palautus — aksentit saa jättää pois"],
  ["listen", "Kuuntelu", null],
  ["recall", "Muistikortti", "Itsearvio, vahvoille sanoille"],
];

const MODE_NAMES = { choice: "Monivalinta", type: "Kirjoitus", listen: "Kuuntelu", recall: "Muistikortti" };
const DIR_NAMES = { fi2it: "Suomesta italiaksi", it2fi: "Italiasta suomeksi" };

const BOX_LABELS = ["Uusi", "1 pv", "2 pv", "4 pv", "8 pv", "16 pv", "32 pv", "64 pv"];

/** Palkkirivi kuten muistiportaissa, mutta osuutena eikä kappalemääränä. */
const bar = (label, pct, right, color) =>
  `<div class="boxrow"><span class="bl">${label}</span><span class="bm"><span style="width:${Math.round(pct * 100)}%;background:${color}"></span></span><span class="bv">${right}</span></div>`;

/**
 * "Missä kompastelet" — vaikeimmat sanat, heikoin harjoitustapa ja suunta,
 * toistuvat virhelajit ja heikoimmat jaksot. Tämä on se näkymä, jossa
 * kertynyt vastaushistoria muuttuu joksikin, mitä voi tehdä.
 */
function weakPanel(s) {
  const w = weakSpots(s);
  if (!w.cards.length && !w.modes.length && !w.errs.length) return "";

  let h = '<div class="panel"><span class="eyebrow">Missä kompastelet</span>';

  if (w.cards.length) {
    h += '<div class="wordlist" style="margin-top:8px">';
    for (const key of w.cards) {
      const c = BY_KEY.get(key);
      const r = s.items[key];
      h += `<div class="row">
        <span class="l">${escapeHtml(c.it)}</span>
        <span class="r">${escapeHtml(c.fi)}<small>${r.miss} virhettä / ${r.seen} kysyttyä</small></span>
        <span class="hbar" title="vaikeus ${Math.round(difficulty(s, key) * 100)} %"><span style="width:${Math.round(difficulty(s, key) * 100)}%"></span></span>
      </div>`;
    }
    h += `</div><button class="btn ghost" data-action="hard" style="margin-top:10px">Treenaa vaikeat sanat</button>`;
  }

  if (w.modes.length > 1 || w.dirs.length > 1) {
    h += '<div style="margin-top:18px"><span class="eyebrow">Osumatarkkuus</span><div style="margin-top:8px">';
    for (const m of w.modes) {
      h += bar(MODE_NAMES[m.k] || m.k, m.pct, `${Math.round(m.pct * 100)}%`, m.pct < 0.7 ? "var(--warm)" : "var(--ok)");
    }
    for (const d of w.dirs) {
      h += bar(DIR_NAMES[d.k] || d.k, d.pct, `${Math.round(d.pct * 100)}%`, d.pct < 0.7 ? "var(--warm)" : "var(--ok)");
    }
    h += "</div></div>";
  }

  if (w.errs.length) {
    const most = w.errs.reduce((a, x) => Math.max(a, x.n), 1);
    h += '<div style="margin-top:18px"><span class="eyebrow">Mikä menee pieleen</span><div style="margin-top:8px">';
    for (const e of w.errs.slice(0, 5)) {
      h += bar(MISS_LABELS[e.k] || e.k, e.n / most, e.n, "var(--accent)");
    }
    h += "</div></div>";
  }

  if (w.units.length) {
    h += `<div style="margin-top:18px"><span class="eyebrow">Takkuavat jaksot</span><div style="margin-top:6px">${w.units
      .map(
        (u) =>
          `<button class="linkrow" data-unit="${u.i}"><span>${String(u.unit.n).padStart(2, "0")} · ${escapeHtml(u.unit.title)}</span><span class="num">${u.hard} vaikeaa</span></button>`,
      )
      .join("")}</div></div>`;
  }

  return h + "</div>";
}

export function renderStats() {
  const s = app.state;
  const o = overview(s);

  let h = `<div class="grid2">
    <div class="stat"><div class="v">${o.known}</div><div class="l">osattua sanaa</div></div>
    <div class="stat"><div class="v">${o.seenCards}</div><div class="l">aloitettua korttia</div></div>
    <div class="stat"><div class="v">${streak(s)}</div><div class="l">päivän putki · ennätys ${s.best || 0}</div></div>
    <div class="stat"><div class="v">${o.accuracy}%</div><div class="l">oikein kaikkiaan</div></div>
  </div>`;

  // kolmen viikon aktiivisuus
  const days = [];
  for (let i = 20; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(todayKey(d));
  }
  const max = Math.max(10, ...days.map((d) => s.log[d] || 0));
  h += `<div class="panel"><span class="eyebrow">Kolme viikkoa</span><div class="bars" style="margin-top:12px">${days
    .map((d) => {
      const n = s.log[d] || 0;
      return `<div class="${n ? "has" : ""}" style="height:${Math.max(3, (n / max) * 64)}px" title="${d}: ${n}"></div>`;
    })
    .join("")}</div><div class="legend"><span>${days[0].slice(5)}</span><span>tänään</span></div></div>`;

  h += weakPanel(s);

  h += '<div class="panel"><span class="eyebrow">Muistiportaat</span><div style="margin-top:8px">';
  o.boxes.forEach((n, i) => {
    const color = i >= KNOWN_BOX ? "var(--ok)" : i >= 2 ? "var(--accent)" : "var(--warm)";
    h += `<div class="boxrow"><span class="bl">${BOX_LABELS[i] || INTERVALS[i] + " pv"}</span><span class="bm"><span style="width:${o.seenCards ? (n / o.seenCards) * 100 : 0}%;background:${color}"></span></span><span class="bv">${n}</span></div>`;
  });
  h += "</div></div>";

  h += '<div class="panel"><span class="eyebrow">Harjoitustavat</span><div style="margin-top:6px">';
  for (const [key, label, sub] of MODES) {
    const hint =
      key === "listen"
        ? !canSpeak
          ? "Selaimesi ei tue puhesynteesiä"
          : hasItalianVoice()
            ? "Selain lukee italian ääneen"
            : "Italiankielistä ääntä ei löytynyt — asenna se käyttöjärjestelmästä"
        : sub;
    h += `<div class="setting"><span class="sl">${label}<small>${hint}</small></span>
      <button class="sw" role="switch" aria-checked="${s.settings[key] ? "true" : "false"}" data-toggle="${key}" aria-label="${label}"></button></div>`;
  }
  if (canSpeak) {
    const voices = listItalianVoices();
    h += voices.length
      ? `<div class="setting"><span class="sl">Ääni<small>Pysyy samana vaikka käyttöjärjestelmä lisää tai muuttaa ääniä</small></span>
        <span style="display:flex;gap:6px;align-items:center">
          <select data-voice style="max-width:150px">
            <option value="">Automaattinen</option>
            ${voices
              .map(
                (v) =>
                  `<option value="${escapeHtml(v.name)}" ${s.settings.voiceName === v.name ? "selected" : ""}>${escapeHtml(v.name)}</option>`,
              )
              .join("")}
          </select>
          <button class="spk" data-action="testvoice" aria-label="Kokeile ääntä">${SPEAKER()}</button>
        </span></div>`
      : `<div class="setting"><span class="sl">Ääni<small>Italiankielisiä ääniä ei löytynyt tästä selaimesta</small></span></div>`;
  }
  h += `<div class="setting"><span class="sl">Päivätavoite<small>${s.settings.goal} korttia päivässä</small></span>
    <input type="range" min="10" max="60" step="5" value="${s.settings.goal}" data-goal style="width:120px;accent-color:var(--accent)"></div>`;
  h += `<div class="setting"><span class="sl">Painota kompastuskiviä<small>Neljännes sessiosta sanoille, jotka jäävät toistuvasti</small></span>
    <button class="sw" role="switch" aria-checked="${s.settings.hard ? "true" : "false"}" data-hard aria-label="Painota kompastuskiviä"></button></div>`;
  h += "</div></div>";

  h += `<div class="panel"><span class="eyebrow">Edistyminen</span>
    <p class="sub" style="color:var(--muted);font-size:.88rem;margin:10px 0 12px">Edistyminen on tallessa tämän selaimen localStoragessa. Vie se tiedostoon, jos haluat varmuuskopion tai siirrät harjoittelun toiselle koneelle.</p>
    <div style="display:flex;gap:8px">
      <button class="btn ghost" data-action="export">Vie tiedostoon</button>
      <button class="btn ghost" data-action="import">Tuo tiedostosta</button>
    </div>
    <button class="btn ghost" data-action="reset" style="margin-top:8px;color:var(--bad);border-color:var(--bad)">Nollaa kaikki edistyminen</button>
  </div>`;

  const host = el("vStats");
  host.innerHTML = h;

  host.querySelectorAll("[data-toggle]").forEach((b) =>
    b.addEventListener("click", () => {
      const key = b.dataset.toggle;
      const on = MODES.map(([k]) => k).filter((k) => s.settings[k]);
      if (s.settings[key] && on.length === 1) return; // vähintään yksi tapa päälle
      s.settings[key] = s.settings[key] ? 0 : 1;
      app.save();
      renderStats();
    }),
  );
  const goal = host.querySelector("[data-goal]");
  goal.addEventListener("change", () => {
    s.settings.goal = Number(goal.value);
    app.save();
    renderStats();
  });
  host.querySelector("[data-hard]").addEventListener("click", () => {
    s.settings.hard = s.settings.hard ? 0 : 1;
    app.save();
    renderStats();
  });
  const voiceSel = host.querySelector("[data-voice]");
  if (voiceSel) {
    voiceSel.addEventListener("change", () => {
      s.settings.voiceName = voiceSel.value;
      app.save();
      refreshVoice();
      say("Buongiorno");
    });
  }
  const testVoice = host.querySelector('[data-action="testvoice"]');
  if (testVoice) testVoice.addEventListener("click", () => say("Buongiorno"));
  onVoicesArrive(() => {
    if (app.tab === "stats") renderStats();
  });
  const focus = host.querySelector('[data-action="hard"]');
  if (focus) focus.addEventListener("click", () => startSession(null, { focus: "hard" }));
  host.querySelectorAll("[data-unit]").forEach((b) =>
    b.addEventListener("click", () => {
      app.unitIndex = Number(b.dataset.unit);
      app.goto("unit");
    }),
  );
  host.querySelector('[data-action="export"]').addEventListener("click", () => store.exportFile(s));
  host.querySelector('[data-action="import"]').addEventListener("click", async () => {
    try {
      app.state = await store.importFile(s);
      app.save();
      app.render();
    } catch (err) {
      alert("Tuonti epäonnistui: " + err.message);
    }
  });
  host.querySelector('[data-action="reset"]').addEventListener("click", () => {
    if (!confirm("Nollataanko kaikki edistyminen? Tätä ei voi perua.")) return;
    store.reset();
    app.state = store.defaultState();
    app.save();
    app.render();
  });
}
