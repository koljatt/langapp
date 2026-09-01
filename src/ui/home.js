import { app, el } from "../app.js";
import { CURRICULUM, CARDS, STAGES } from "../data/index.js";
import { boxOf, dueKeys, isNew, openCount, streak, unitStats, KNOWN_BOX } from "../lib/srs.js";
import { escapeHtml, todayKey } from "../lib/text.js";
import { ring, LOCK } from "./icons.js";
import { startSession } from "./drill.js";

export function renderHome() {
  const s = app.state;
  const open = openCount(s);
  const due = dueKeys(s).length;
  const known = CARDS.filter((c) => boxOf(s, c.key) >= KNOWN_BOX).length;
  const newAvailable = CURRICULUM.slice(0, open)
    .flatMap((u) => u.keys)
    .filter((k) => isNew(s, k)).length;
  const doneToday = s.log[todayKey()] || 0;
  const goal = s.settings.goal;

  let h = '<div class="hero">';
  if (due > 0) {
    h += `<div><span class="eyebrow">Päivän kertaus</span><h2>${due} korttia odottaa</h2></div>`;
    h += `<div class="meter"><span style="width:${Math.min(100, (doneToday / goal) * 100)}%"></span></div>`;
    h += `<div class="sub num">${doneToday} / ${goal} tänään · putki ${streak(s)} päivää</div>`;
    h += '<button class="btn" data-action="review">Aloita kertaus</button>';
  } else if (newAvailable > 0) {
    h += '<div><span class="eyebrow">Kaikki kerrattu</span><h2>Aika uusille sanoille</h2></div>';
    h += `<p class="sub">Avoimissa jaksoissa on ${newAvailable} sanaa, joita et ole vielä nähnyt.</p>`;
    h += '<button class="btn" data-action="review">Opettele uutta</button>';
  } else {
    h += '<div><span class="eyebrow">Valmista</span><h2>Ei kerrattavaa juuri nyt</h2></div>';
    h += '<p class="sub">Palaa huomenna, tai avaa jakso alta ja harjoittele vapaasti.</p>';
    h += '<button class="btn ghost" data-action="force">Harjoittele silti</button>';
  }
  h += "</div>";

  h += `<div class="grid2">
    <div class="stat"><div class="v">${known}</div><div class="l">sanaa osattu / ${CARDS.length}</div></div>
    <div class="stat"><div class="v">${open}</div><div class="l">jaksoa avattu / ${CURRICULUM.length}</div></div>
  </div>`;

  for (const stage of STAGES) {
    const total = stage.units.reduce((a, u) => a + u.keys.length, 0);
    const kn = stage.units.reduce((a, u) => a + unitStats(s, u).known, 0);
    h += `<div class="stagehead"><span class="eyebrow">${escapeHtml(stage.name)}</span><hr><span class="num">${Math.round((kn / total) * 100)}%</span></div><div class="units">`;
    for (const u of stage.units) {
      const st = unitStats(s, u);
      const locked = u.n > open;
      const right = st.due
        ? `<span class="badge" title="${st.due} kerrattavaa">${st.due}</span>`
        : locked
          ? `<span class="badge muted" title="Ei vielä kertausvuorossa">${LOCK}</span>`
          : ring(st.pct);
      h += `<button class="unit${st.pct >= 0.999 ? " done" : ""}${locked ? " locked" : ""}" data-unit="${u.n - 1}"${
        locked ? ' title="Tulee kertaukseen kun edellinen jakso on 60 % osattu — voit silti selata ja harjoitella sitä"' : ""
      }>
        <span class="idx">${String(u.n).padStart(2, "0")}</span>
        <span><span class="tt">${escapeHtml(u.title)}</span><br><span class="it">${escapeHtml(u.it)}</span></span>
        ${right}
      </button>`;
    }
    h += "</div>";
  }

  const host = el("vHome");
  host.innerHTML = h;

  host.querySelectorAll("[data-unit]").forEach((b) => {
    b.addEventListener("click", () => {
      app.unitIndex = Number(b.dataset.unit);
      app.goto("unit");
    });
  });
  const review = host.querySelector('[data-action="review"]');
  if (review) review.addEventListener("click", () => startSession(null));
  const force = host.querySelector('[data-action="force"]');
  if (force) force.addEventListener("click", () => startSession(null, true));
}
