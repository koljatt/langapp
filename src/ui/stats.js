import { app, el } from "../app.js";
import { overview, streak, INTERVALS, KNOWN_BOX } from "../lib/srs.js";
import { todayKey } from "../lib/text.js";
import { canSpeak, hasItalianVoice } from "../lib/speech.js";
import * as store from "../lib/store.js";

const MODES = [
  ["choice", "Monivalinta", "Nopea tunnistus, uusille sanoille"],
  ["type", "Kirjoitus", "Aktiivinen palautus — aksentit saa jättää pois"],
  ["listen", "Kuuntelu", null],
  ["recall", "Muistikortti", "Itsearvio, vahvoille sanoille"],
];

const BOX_LABELS = ["Uusi", "1 pv", "2 pv", "4 pv", "8 pv", "16 pv", "32 pv", "64 pv"];

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
  h += `<div class="setting"><span class="sl">Päivätavoite<small>${s.settings.goal} korttia päivässä</small></span>
    <input type="range" min="10" max="60" step="5" value="${s.settings.goal}" data-goal style="width:120px;accent-color:var(--accent)"></div>`;
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
