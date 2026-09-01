import { app, el } from "../app.js";
import { CURRICULUM, CARDS, BY_KEY } from "../data/index.js";
import { boxOf, dueKeys, grade, introduce, isNew, openCount, streak } from "../lib/srs.js";
import { acceptedForms, dropArticle, escapeHtml, finnishForms, norm, shuffle } from "../lib/text.js";
import { canSpeak, say, stopSpeaking } from "../lib/speech.js";
import { SPEAKER } from "./icons.js";

const MODE_KEYS = ["choice", "type", "listen", "recall"];

let queue = [];
let index = 0;
let answered = false;
let right = 0;
let total = 0;
let flip = null;

const enabledModes = () =>
  MODE_KEYS.filter((m) => app.state.settings[m] && (m !== "listen" || canSpeak));

/** Harjoitustapa laatikon mukaan: tunnistus → kirjoitus → vapaa palautus. */
function modeFor(key) {
  const on = enabledModes();
  if (!on.length) return "choice";
  if (on.includes("listen") && Math.random() < 0.22) return "listen";
  const b = boxOf(app.state, key);
  let want = b <= 1 ? "choice" : b <= 3 ? "type" : "recall";
  if (!on.includes(want)) want = on[Math.floor(Math.random() * on.length)];
  return want;
}

export function startSession(unitIndex = null, force = false) {
  const s = app.state;
  const open = openCount(s);
  const pool = [
    ...new Set(
      unitIndex == null
        ? CURRICULUM.slice(0, open).flatMap((u) => u.keys)
        : CURRICULUM[unitIndex].keys,
    ),
  ];
  const goal = s.settings.goal;

  let list = dueKeys(s, pool);
  if (list.length < goal) {
    list = list.concat(pool.filter((k) => isNew(s, k)).slice(0, goal - list.length));
  }
  if (!list.length && force) list = shuffle(pool).slice(0, goal);
  if (!list.length) {
    list = pool
      .filter((k) => !isNew(s, k))
      .sort((a, b) => s.items[a].due - s.items[b].due)
      .slice(0, goal);
  }
  list = list.slice(0, goal);
  if (!list.length) return;

  queue = list.map((k) => ({ key: k, mode: isNew(s, k) ? "intro" : modeFor(k), retry: 0 }));
  index = 0;
  right = 0;
  total = 0;
  el("drill").classList.add("on");
  document.body.style.overflow = "hidden";
  step();
}

export function quitDrill() {
  el("drill").classList.remove("on");
  document.body.style.overflow = "";
  stopSpeaking();
  flip = null;
  app.render();
}

const isOpen = () => el("drill").classList.contains("on");

function step() {
  answered = false;
  flip = null;
  el("dFoot").innerHTML = "";
  if (index >= queue.length) return finish();

  el("dBar").style.width = `${(index / queue.length) * 100}%`;
  el("dCount").textContent = `${index + 1}/${queue.length}`;

  const q = queue[index];
  const card = BY_KEY.get(q.key);
  ({ intro: viewIntro, choice: viewChoice, type: viewType, listen: viewListen, recall: viewRecall })[
    q.mode
  ](card, q);
}

const next = () => {
  index++;
  step();
};

/** Väärin mennyt kortti palaa saman session loppuun kerran. */
function requeue(q) {
  if (q.retry < 1) queue.push({ key: q.key, mode: "type", retry: 1 });
}

/** Häiriövaihtoehdot samasta jaksosta — lähisukuiset erottelevat paremmin. */
function distractors(card, field, n) {
  const unit = CURRICULUM[card.units[0]];
  const near = unit.keys.map((k) => BY_KEY.get(k)).filter((x) => x && x.key !== card.key);
  const pool = near.length >= n ? near : near.concat(CARDS.filter((x) => x.key !== card.key));
  const used = new Set([norm(card[field])]);
  const out = [];
  for (const x of shuffle(pool)) {
    const v = norm(x[field]);
    if (used.has(v)) continue;
    used.add(v);
    out.push(x);
    if (out.length === n) break;
  }
  return out;
}

function speakerButton(text, big = false) {
  if (!canSpeak) return "";
  return `<button class="speakbtn${big ? " hero" : ""}" data-say="${escapeHtml(text)}" aria-label="Kuuntele">${SPEAKER(big ? 30 : 18)}${big ? "" : " Kuuntele"}</button>`;
}
function bindSpeak(host) {
  host.querySelectorAll("[data-say]").forEach((b) => b.addEventListener("click", () => say(b.dataset.say)));
}

/* ---------- uusi sana ---------- */
function viewIntro(card) {
  const stage = el("dStage");
  stage.innerHTML = `<div class="reveal">
    <span class="eyebrow">Uusi sana</span>
    <div class="prompt"><div class="big">${escapeHtml(card.it)}</div></div>
    <div style="font-size:1.15rem;font-weight:500">${escapeHtml(card.fi)}</div>
    ${card.note ? `<div class="verdict"><span class="note">${escapeHtml(card.note)}</span></div>` : ""}
    ${speakerButton(card.it)}
  </div>`;
  bindSpeak(stage);
  el("dFoot").innerHTML = '<button class="btn" data-action="go">Jatka</button>';
  el("dFoot").querySelector("[data-action]").addEventListener("click", () => {
    introduce(app.state, card.key);
    app.save();
    const on = enabledModes();
    queue[index].mode = on.includes("choice") ? "choice" : on[0] || "choice";
    step();
  });
  if (canSpeak) setTimeout(() => say(card.it), 220);
}

/* ---------- monivalinta ---------- */
function viewChoice(card, q) {
  const toItalian = Math.random() < 0.5;
  const field = toItalian ? "it" : "fi";
  const options = shuffle([card, ...distractors(card, field, 3)]);
  const stage = el("dStage");

  stage.innerHTML = `<div class="prompt">
      <span class="eyebrow">${toItalian ? "Miten sanot italiaksi?" : "Mitä tämä tarkoittaa?"}</span>
      <div class="big${toItalian ? " fi" : ""}">${escapeHtml(toItalian ? card.fi : card.it)}</div>
      ${toItalian && card.note ? `<div class="hint">${escapeHtml(card.note)}</div>` : ""}
    </div>
    <div class="opts">${options
      .map(
        (o, i) =>
          `<button class="opt" data-i="${i}"><span class="k">${i + 1}</span><span>${escapeHtml(o[field])}</span></button>`,
      )
      .join("")}</div>
    <div class="verdict" id="vd"></div>
    <div class="kbd">1–4 valitse · Enter jatka</div>`;

  const buttons = [...stage.querySelectorAll(".opt")];
  buttons.forEach((b, i) =>
    b.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      const ok = options[i].key === card.key;
      buttons.forEach((x) => (x.disabled = true));
      b.classList.add(ok ? "right" : "wrong");
      if (!ok) buttons[options.findIndex((o) => o.key === card.key)].classList.add("right");
      if (!toItalian) say(card.it);
      settle(card, q, ok, toItalian ? card.it : card.fi);
    }),
  );
}

/* ---------- kirjoitus ---------- */
function viewType(card, q) {
  const toItalian = Math.random() < 0.72;
  const stage = el("dStage");
  stage.innerHTML = `<div class="prompt">
      <span class="eyebrow">${toItalian ? "Kirjoita italiaksi" : "Kirjoita suomeksi"}</span>
      <div class="big${toItalian ? " fi" : ""}">${escapeHtml(toItalian ? card.fi : card.it)}</div>
      ${toItalian && card.note ? `<div class="hint">${escapeHtml(card.note)}</div>` : ""}
    </div>
    <input class="typed" id="tin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${toItalian ? "italiaksi" : "suomeksi"}">
    <div class="verdict" id="vd"></div>
    <div class="kbd">Enter tarkista</div>`;

  const input = el("tin");
  setTimeout(() => input.focus(), 40);
  el("dFoot").innerHTML = '<button class="btn" data-action="check">Tarkista</button>';

  const check = () => {
    if (answered) return;
    answered = true;
    const v = norm(input.value);
    let ok;
    if (toItalian) {
      ok = acceptedForms(card).has(v) || v === norm(dropArticle(card.it));
      // sama suomenkielinen merkitys voi vastata useaa italian sanaa (scusa / scusi)
      if (!ok) ok = CARDS.some((x) => norm(x.fi) === norm(card.fi) && acceptedForms(x).has(v));
    } else {
      ok = finnishForms(card).has(v);
    }
    input.disabled = true;
    input.classList.add(ok ? "right" : "wrong");
    if (toItalian) say(card.it);
    settle(card, q, ok, toItalian ? card.it : card.fi);
  };

  el("dFoot").querySelector("[data-action]").addEventListener("click", check);
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (answered) {
      const n = el("dFoot").querySelector('[data-action="next"]');
      if (n) n.click();
    } else check();
  });
}

/* ---------- kuuntelu ---------- */
function viewListen(card, q) {
  const options = shuffle([card, ...distractors(card, "fi", 3)]);
  const stage = el("dStage");
  stage.innerHTML = `<div class="prompt"><span class="eyebrow">Kuuntele</span></div>
    ${speakerButton(card.it, true)}
    <div class="opts">${options
      .map(
        (o, i) =>
          `<button class="opt" data-i="${i}"><span class="k">${i + 1}</span><span>${escapeHtml(o.fi)}</span></button>`,
      )
      .join("")}</div>
    <div class="verdict" id="vd"></div>
    <div class="kbd">Välilyönti toistaa · 1–4 valitse</div>`;
  bindSpeak(stage);
  setTimeout(() => say(card.it), 260);

  const buttons = [...stage.querySelectorAll(".opt")];
  buttons.forEach((b, i) =>
    b.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      const ok = options[i].key === card.key;
      buttons.forEach((x) => (x.disabled = true));
      b.classList.add(ok ? "right" : "wrong");
      if (!ok) buttons[options.findIndex((o) => o.key === card.key)].classList.add("right");
      settle(card, q, ok, card.it);
    }),
  );
}

/* ---------- muistikortti ---------- */
function viewRecall(card, q) {
  const stage = el("dStage");
  stage.innerHTML = `<div class="reveal">
      <span class="eyebrow">Muistatko?</span>
      <div class="prompt"><div class="big">${escapeHtml(card.it)}</div></div>
      <div id="sol" hidden>
        <div style="font-size:1.2rem;font-weight:500">${escapeHtml(card.fi)}</div>
        ${card.note ? `<div style="color:var(--muted);font-size:.85rem;margin-top:4px">${escapeHtml(card.note)}</div>` : ""}
      </div>
    </div>
    <div class="kbd">Välilyönti näyttää käännöksen</div>`;
  el("dFoot").innerHTML = '<button class="btn ghost" data-action="flip">Näytä käännös</button>';

  flip = () => {
    if (answered) return;
    answered = true;
    el("sol").hidden = false;
    say(card.it);
    el("dFoot").innerHTML = "";
    stage.insertAdjacentHTML(
      "beforeend",
      `<div class="rate">
        <button class="no" data-r="0">En muistanut<small>alusta</small></button>
        <button class="mid" data-r="1">Melkein<small>pian uudestaan</small></button>
        <button class="yes" data-r="2">Osasin<small>eteenpäin</small></button>
      </div>`,
    );
    stage.querySelectorAll(".rate button").forEach((b) =>
      b.addEventListener("click", () => {
        const r = Number(b.dataset.r);
        grade(app.state, card.key, r === 2);
        if (r === 2) right++;
        else if (r === 1) requeue(q);
        app.save();
        total++;
        next();
      }),
    );
  };
  el("dFoot").querySelector("[data-action]").addEventListener("click", flip);
}

/* ---------- vastauksen jälkeen ---------- */
function settle(card, q, ok, solution) {
  grade(app.state, card.key, ok);
  app.save();
  total++;
  if (ok) right++;
  else requeue(q);

  const vd = el("vd");
  if (vd) {
    vd.innerHTML = ok
      ? `<span class="vt ok">Bravo!</span>${card.note ? `<span class="note">${escapeHtml(card.note)}</span>` : ""}`
      : `<span class="vt no">Oikea vastaus</span><span class="sol">${escapeHtml(solution)}</span>${card.note ? `<span class="note">${escapeHtml(card.note)}</span>` : ""}`;
  }
  const last = index + 1 >= queue.length;
  el("dFoot").innerHTML = `<button class="btn" data-action="next">${last ? "Valmis" : "Seuraava"}</button>`;
  const btn = el("dFoot").querySelector('[data-action="next"]');
  btn.addEventListener("click", next);
  btn.focus({ preventScroll: true });
}

function finish() {
  el("dBar").style.width = "100%";
  const pct = total ? Math.round((right / total) * 100) : 0;
  const msg = pct >= 90 ? "Perfetto." : pct >= 70 ? "Bene." : pct >= 50 ? "Jatka samaan malliin." : "Toisto tekee mestarin.";
  el("dStage").innerHTML = `<div class="reveal">
    <span class="eyebrow">Sessio päättyi</span>
    <h2 style="font-family:'Bodoni Moda',Georgia,serif;font-weight:400;font-size:2rem">${msg}</h2>
    <div class="grid2" style="margin-top:6px">
      <div class="stat"><div class="v">${right}/${total}</div><div class="l">oikein</div></div>
      <div class="stat"><div class="v">${streak(app.state)}</div><div class="l">päivän putki</div></div>
    </div>
  </div>`;
  el("dCount").textContent = `${total}/${total}`;
  el("dFoot").innerHTML = `<button class="btn ghost" data-action="quit">Takaisin kurssiin</button>
    <button class="btn" data-action="more">Vielä lisää</button>`;
  el("dFoot").querySelector('[data-action="quit"]').addEventListener("click", quitDrill);
  el("dFoot").querySelector('[data-action="more"]').addEventListener("click", () => startSession(null));
}

/* ---------- näppäimistö ---------- */
export function initDrill() {
  el("dQuit").addEventListener("click", quitDrill);

  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") return quitDrill();

    const q = queue[index];
    if (e.key === " " && q && (q.mode === "recall" || q.mode === "listen")) {
      e.preventDefault();
      if (q.mode === "listen") say(BY_KEY.get(q.key).it);
      else if (flip) flip();
      return;
    }
    if (/^[1-4]$/.test(e.key) && !answered) {
      const b = document.querySelectorAll(".opt")[Number(e.key) - 1];
      if (b) b.click();
    }
    if (e.key === "Enter" && answered) {
      const n = el("dFoot").querySelector('[data-action="next"]');
      if (n) {
        e.preventDefault();
        n.click();
      }
    }
  });
}
