/**
 * Tasotesti: kurssin jaksot käydään läpi järjestyksessä, 4 monivalintakysymystä
 * per jakso. Jakso läpäistään 3/4:llä (arvaamalla 5 vaihtoehdosta tulee 3/4
 * vain ~3 %:n todennäköisyydellä), ja testi loppuu kun kaksi jaksoa peräkkäin
 * menee ohi. Läpäistyt jaksot voi merkitä osatuiksi — kortit erääntyvät
 * silti huomenna, joten arvaus tarkistuu pian.
 */

import { app, el } from "../app.js";
import { CURRICULUM, BY_KEY } from "../data/index.js";
import { applyPlacement } from "../lib/srs.js";
import { escapeHtml, shuffle } from "../lib/text.js";
import { distractors, quitDrill } from "./drill.js";

const PER_UNIT = 4;
const PASS = 3;
const STOP_AFTER = 2;

let units = []; // testattavat jaksot
let ui = 0; // nykyinen jakso (indeksi units-taulukossa)
let qi = 0; // kysymys jaksossa
let questions = [];
let hits = 0;
let failsInRow = 0;
let passed = [];
let locked = false;

/** Jakso on jo aloitettu, jos sen kaikilla korteilla on tila — niitä ei testata. */
const untouched = (u) => u.keys.some((k) => !app.state.items[k]);

export function startPlacement() {
  units = CURRICULUM.map((u, i) => ({ u, i })).filter((x) => untouched(x.u));
  ui = 0;
  passed = [];
  failsInRow = 0;
  el("drill").classList.add("on");
  document.body.style.overflow = "hidden";
  el("dBar").style.width = "0%";
  el("dCount").textContent = "";
  el("dStage").innerHTML = `<div class="reveal">
    <span class="eyebrow">Tasotesti</span>
    <h2 style="font-family:'Bodoni Moda',Georgia,serif;font-weight:400;font-size:1.8rem">Mitä osaat jo?</h2>
    <p class="sub" style="color:var(--muted)">Kysyn ${PER_UNIT} sanaa jokaisesta jaksosta alkaen ensimmäisestä. Jos osaat jakson, voit ohittaa sen. Testi loppuu kun ${STOP_AFTER} jaksoa peräkkäin menee ohi. Jos et tiedä, valitse "En osaa" — arvaaminen ei kannata.</p>
  </div>`;
  el("dFoot").innerHTML = '<button class="btn ghost" data-action="quit">Ei nyt</button><button class="btn" data-action="go">Aloita</button>';
  el("dFoot").querySelector('[data-action="quit"]').addEventListener("click", quitDrill);
  el("dFoot").querySelector('[data-action="go"]').addEventListener("click", nextUnit);
}

function nextUnit() {
  if (ui >= units.length || failsInRow >= STOP_AFTER) return finish();
  const { u } = units[ui];
  const keys = shuffle(u.keys.filter((k) => !app.state.items[k])).slice(0, PER_UNIT);
  // Pieni jakso, josta ei riitä kysyttävää: hyväksytään sellaisenaan.
  if (keys.length < PER_UNIT) {
    passed.push(units[ui].i);
    ui++;
    return nextUnit();
  }
  questions = keys.map((k) => BY_KEY.get(k));
  qi = 0;
  hits = 0;
  ask();
}

function ask() {
  locked = false;
  const { u } = units[ui];
  el("dBar").style.width = `${(ui / units.length) * 100}%`;
  el("dCount").textContent = `jakso ${u.n}/${CURRICULUM.length}`;
  el("dFoot").innerHTML = "";

  const card = questions[qi];
  const toItalian = Math.random() < 0.5;
  const field = toItalian ? "it" : "fi";
  const options = shuffle([card, ...distractors(card, field, 3)]);
  el("dStage").innerHTML = `<div class="prompt">
      <span class="eyebrow">${escapeHtml(u.title)} · ${qi + 1}/${PER_UNIT}</span>
      <div class="big${toItalian ? " fi" : ""}">${escapeHtml(toItalian ? card.fi : card.it)}</div>
    </div>
    <div class="opts">${options
      .map((o, i) => `<button class="opt" data-i="${i}"><span class="k">${i + 1}</span><span>${escapeHtml(o[field])}</span></button>`)
      .join("")}
      <button class="opt" data-idk><span class="k">–</span><span>En osaa</span></button>
    </div>`;

  const buttons = [...el("dStage").querySelectorAll(".opt")];
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      if (locked) return;
      locked = true;
      const idk = b.hasAttribute("data-idk");
      const ok = !idk && options[Number(b.dataset.i)].key === card.key;
      if (ok) hits++;
      buttons.forEach((x) => (x.disabled = true));
      if (!idk) b.classList.add(ok ? "right" : "wrong");
      const right = buttons[options.findIndex((o) => o.key === card.key)];
      if (right) right.classList.add("right");
      setTimeout(advance, ok ? 450 : 900);
    }),
  );
}

function advance() {
  qi++;
  if (qi < PER_UNIT) return ask();
  if (hits >= PASS) {
    passed.push(units[ui].i);
    failsInRow = 0;
  } else {
    failsInRow++;
  }
  ui++;
  nextUnit();
}

function finish() {
  el("dBar").style.width = "100%";
  el("dCount").textContent = "";
  const cards = passed.reduce((n, i) => n + CURRICULUM[i].keys.filter((k) => !app.state.items[k]).length, 0);
  const list = passed.map((i) => `<div class="row"><span class="l">${String(CURRICULUM[i].n).padStart(2, "0")}</span><span class="r">${escapeHtml(CURRICULUM[i].title)}</span><span></span></div>`).join("");
  el("dStage").innerHTML = `<div class="reveal">
    <span class="eyebrow">Testi valmis</span>
    <h2 style="font-family:'Bodoni Moda',Georgia,serif;font-weight:400;font-size:1.8rem">${passed.length ? `${passed.length} jaksoa hallussa` : "Aloitetaan alusta"}</h2>
    <p class="sub" style="color:var(--muted)">${passed.length ? `${cards} sanaa merkitään osatuiksi. Ne tulevat kertaukseen jo huomenna, joten jos arvasit, se paljastuu pian.` : "Kurssi alkaa ensimmäisestä jaksosta — se on ihan hyvä paikka aloittaa."}</p>
  </div>${passed.length ? `<div class="panel"><div class="wordlist">${list}</div></div>` : ""}`;
  el("dFoot").innerHTML = passed.length
    ? '<button class="btn ghost" data-action="quit">Älä merkitse</button><button class="btn" data-action="apply">Merkitse osatuiksi</button>'
    : '<button class="btn" data-action="quit">Sulje</button>';
  el("dFoot").querySelector('[data-action="quit"]').addEventListener("click", quitDrill);
  const apply = el("dFoot").querySelector('[data-action="apply"]');
  if (apply) {
    apply.addEventListener("click", () => {
      applyPlacement(app.state, passed);
      app.save();
      quitDrill();
    });
  }
}
