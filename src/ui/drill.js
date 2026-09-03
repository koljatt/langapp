import { app, el } from "../app.js";
import { CURRICULUM, CARDS, BY_KEY } from "../data/index.js";
import { VERB_CARDS, VERB_BY_KEY, VERB_GROUPS } from "../data/verbs.js";
import {
  boxOf,
  dueKeys,
  grade,
  hardKeys,
  introduce,
  isNew,
  isStruggling,
  openCount,
  streak,
} from "../lib/srs.js";
import {
  accentSlip,
  acceptedForms,
  classifyMiss,
  dropArticle,
  escapeHtml,
  finnishForms,
  genderOf,
  isTypo,
  norm,
  shuffle,
} from "../lib/text.js";
import { hasItalianVoice, say, stopSpeaking } from "../lib/speech.js";
import { SPEAKER } from "./icons.js";

const MODE_KEYS = ["choice", "type", "listen", "recall"];
/** Osuus sessiosta, joka varataan kompastuskiville vaikka vuoro ei olisi. */
const HARD_SHARE = 0.25;

/** Lyhyt syy vastauksen perässä — siitä oppii enemmän kuin pelkästä ruksista. */
const MISS_HINTS = {
  tupla: "Kaksoiskonsonantti — italiassa se kuuluu ja kirjoitetaan.",
  paate: "Pääte heittää: tarkista suku ja luku.",
  artikkeli: "Artikkeli meni väärin.",
  kirjoitus: "Lähellä — kirjoitusasu heittää.",
  sekaannus: "Sekoittui toiseen sanaan.",
  tyhja: "",
};

let queue = [];
let index = 0;
let answered = false;
let right = 0;
let total = 0;
let missed = [];
let flip = null;
/** finish()-näytön "Vielä lisää" käynnistää saman tyyppisen session uudelleen. */
let restartSession = () => startSession(null);

const enabledModes = () =>
  MODE_KEYS.filter((m) => app.state.settings[m] && (m !== "listen" || hasItalianVoice()));

/**
 * Harjoitustapa laatikon mukaan: tunnistus → kirjoitus → vapaa palautus.
 * Kompastuskivi ei pääse muistikortille asti: itsearvio on juuri se paikka,
 * johon vaikea sana jää piiloon.
 */
function modeFor(key) {
  const on = enabledModes();
  if (!on.length) return "choice";
  const b = boxOf(app.state, key);
  // Sanelu vaatii kirjoitustaidon: ei tarjota sanalle jota ei ole vielä kirjoitettu kertaakaan.
  if (b >= 2 && on.includes("listen") && Math.random() < 0.22) return "listen";
  let want = b <= 1 ? "choice" : b <= 3 ? "type" : "recall";
  if (want === "recall" && isStruggling(app.state, key)) want = "type";
  if (!on.includes(want)) want = on[Math.floor(Math.random() * on.length)];
  return want;
}

/**
 * Session kortit. Kerrattavat ensin kiireellisyysjärjestyksessä, ja niiden
 * lisäksi joukko kompastuskiviä vaikka niiden vuoro ei vielä olisi — se on
 * koko pointti siinä, että sovellus oppii mikä tuottaa vaikeuksia.
 * Uudet sanat jäävät loppuun, jotta kertaus tulee ensin tehtyä.
 */
function buildQueue(pool, goal, opts) {
  const s = app.state;

  if (opts.focus === "hard") {
    return hardKeys(s, pool, goal);
  }

  let due = dueKeys(s, pool);
  const boost = s.settings.hard ? Math.min(Math.round(goal * HARD_SHARE), goal) : 0;
  const extra = boost
    ? hardKeys(s, pool).filter((k) => !due.includes(k)).slice(0, boost)
    : [];

  due = due.slice(0, goal - extra.length);
  let list = shuffle([...due, ...extra]);

  if (list.length < goal) {
    list = list.concat(pool.filter((k) => isNew(s, k)).slice(0, goal - list.length));
  }
  if (!list.length && opts.force) list = shuffle(pool).slice(0, goal);
  if (!list.length) {
    list = pool
      .filter((k) => !isNew(s, k))
      .sort((a, b) => s.items[a].due - s.items[b].due)
      .slice(0, goal);
  }
  return list.slice(0, goal);
}

/**
 * @param {number|null} unitIndex  yksittäinen jakso, tai null = kaikki avoimet
 * @param {{force?:boolean, focus?:"hard"}} opts
 */
export function startSession(unitIndex = null, opts = {}) {
  const s = app.state;
  const open = openCount(s);
  const pool = [
    ...new Set(
      unitIndex == null
        ? CURRICULUM.slice(0, open).flatMap((u) => u.keys)
        : CURRICULUM[unitIndex].keys,
    ),
  ];

  const list = buildQueue(pool, s.settings.goal, opts);
  if (!list.length) return;

  queue = list.map((k) => ({ key: k, mode: isNew(s, k) ? "intro" : modeFor(k), retry: 0 }));
  index = 0;
  right = 0;
  total = 0;
  missed = [];
  restartSession = () => startSession(unitIndex, opts);
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

/** Merkintä kortille, jonka kanssa on toistuvasti hankaluuksia. */
const struggleTag = (card) =>
  isStruggling(app.state, card.key) ? '<span class="tag hard">Kompastuskivi</span>' : "";

/** Kompastuskiven vihje näytetään kummassakin suunnassa, ei vain italiaksi. */
const hintFor = (card, always) =>
  card.note && (always || isStruggling(app.state, card.key))
    ? `<div class="hint">${escapeHtml(card.note)}</div>`
    : "";

/**
 * Häiriövaihtoehdot samasta jaksosta — lähisukuiset erottelevat paremmin.
 * Toinen puoli kortista on tarkistettava myös: "scusa" ja "scusi" ovat eri
 * italiaa mutta samaa suomea, eikä kysymyksellä saa olla kahta oikeaa.
 */
function distractors(card, field, n) {
  const other = field === "it" ? "fi" : "it";
  const same = norm(card[other]);
  const ok = (x) => x && x.key !== card.key && norm(x[other]) !== same;
  const unit = CURRICULUM[card.units[0]];
  const near = unit.keys.map((k) => BY_KEY.get(k)).filter(ok);
  const pool = near.length >= n ? near : near.concat(CARDS.filter(ok));
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
  if (!hasItalianVoice()) return "";
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
    // Sanelu ei sovi juuri esitellylle sanalle: se vaatii kirjoitustaidon, jota ei vielä ole.
    queue[index].mode = on.includes("choice")
      ? "choice"
      : on.includes("type")
        ? "type"
        : on.includes("recall")
          ? "recall"
          : on[0] || "choice";
    step();
  });
  if (hasItalianVoice()) setTimeout(() => say(card.it), 220);
}

/* ---------- monivalinta ---------- */
function viewChoice(card, q) {
  const toItalian = Math.random() < 0.5;
  const field = toItalian ? "it" : "fi";
  const options = shuffle([card, ...distractors(card, field, 3)]);
  const stage = el("dStage");

  stage.innerHTML = `<div class="prompt">
      <span class="eyebrow">${toItalian ? "Miten sanot italiaksi?" : "Mitä tämä tarkoittaa?"}</span>
      ${struggleTag(card)}
      <div class="big${toItalian ? " fi" : ""}">${escapeHtml(toItalian ? card.fi : card.it)}</div>
      ${hintFor(card, toItalian)}
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
      settle(card, q, ok, toItalian ? card.it : card.fi, {
        mode: "choice",
        dir: toItalian ? "fi2it" : "it2fi",
        err: ok ? null : "sekaannus",
      });
    }),
  );
}

/**
 * Vertaa kirjoitettua vastausta italiankieliseen korttiin. Käyttää sekä
 * kirjoitustehtävää että sanelua (dictation) — molemmissa kirjoitetaan
 * italiaa kuultuun tai näytettyyn suomeen.
 */
function evaluateItalianTyped(raw, card) {
  const v = norm(raw);
  const forms = [
    ...new Set(
      CARDS.filter((x) => norm(x.fi) === norm(card.fi)).flatMap((x) => [x.it, dropArticle(x.it)]),
    ),
  ];
  let ok = acceptedForms(card).has(v) || v === norm(dropArticle(card.it));
  // sama suomenkielinen merkitys voi vastata useaa italian sanaa (scusa / scusi)
  if (!ok) ok = CARDS.some((x) => norm(x.fi) === norm(card.fi) && acceptedForms(x).has(v));
  // Yhden kirjaimen lipsahdus ei ole unohtunut sana: laatikko jää paikalleen.
  const near = !ok && isTypo(raw, forms);
  return {
    ok,
    near,
    verdict: ok ? true : near ? "near" : false,
    err: ok || near ? null : classifyMiss(raw, forms),
    slip: ok ? accentSlip(raw, forms) : null,
  };
}

/* ---------- kirjoitus ---------- */
function viewType(card, q) {
  const toItalian = Math.random() < 0.72;
  const stage = el("dStage");
  stage.innerHTML = `<div class="prompt">
      <span class="eyebrow">${toItalian ? "Kirjoita italiaksi" : "Kirjoita suomeksi"}</span>
      ${struggleTag(card)}
      <div class="big${toItalian ? " fi" : ""}">${escapeHtml(toItalian ? card.fi : card.it)}</div>
      ${hintFor(card, toItalian)}
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
    const raw = input.value;

    let result;
    if (toItalian) {
      result = evaluateItalianTyped(raw, card);
    } else {
      const ok = finnishForms(card).has(norm(raw));
      result = { ok, near: false, verdict: ok, err: ok ? null : classifyMiss(raw, [...finnishForms(card)]), slip: null };
    }

    input.disabled = true;
    input.classList.add(result.ok ? "right" : result.near ? "near" : "wrong");
    if (toItalian) say(card.it);

    settle(card, q, result.verdict, toItalian ? card.it : card.fi, {
      mode: "type",
      dir: toItalian ? "fi2it" : "it2fi",
      err: result.err,
      typed: raw,
      slip: result.slip,
    });
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

/* ---------- kuuntelu (sanelu) ---------- */
function viewListen(card, q) {
  const stage = el("dStage");
  stage.innerHTML = `<div class="prompt"><span class="eyebrow">Kuuntele ja kirjoita italiaksi</span>${struggleTag(card)}</div>
    ${speakerButton(card.it, true)}
    <input class="typed" id="tin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="mitä kuulit?">
    <div class="verdict" id="vd"></div>
    <div class="kbd">Kuuntele-painike toistaa · Enter tarkista</div>`;
  bindSpeak(stage);
  setTimeout(() => say(card.it), 260);

  const input = el("tin");
  setTimeout(() => input.focus(), 300);
  el("dFoot").innerHTML = '<button class="btn" data-action="check">Tarkista</button>';

  const check = () => {
    if (answered) return;
    answered = true;
    const raw = input.value;
    const result = evaluateItalianTyped(raw, card);

    input.disabled = true;
    input.classList.add(result.ok ? "right" : result.near ? "near" : "wrong");
    say(card.it);

    settle(card, q, result.verdict, card.it, {
      mode: "listen",
      dir: "fi2it",
      err: result.err,
      typed: raw,
      slip: result.slip,
    });
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

/* ---------- muistikortti ---------- */
function viewRecall(card, q) {
  const stage = el("dStage");
  stage.innerHTML = `<div class="reveal">
      <span class="eyebrow">Muistatko?</span>
      ${struggleTag(card)}
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
        const verdict = r === 2 ? true : r === 1 ? "near" : false;
        grade(app.state, card.key, verdict, {
          mode: "recall",
          dir: "it2fi",
          err: r === 0 ? "eisana" : null,
        });
        if (r === 2) right++;
        else {
          requeue(q);
          if (r === 0) missed.push(card);
        }
        app.save();
        total++;
        next();
      }),
    );
  };
  el("dFoot").querySelector("[data-action]").addEventListener("click", flip);
}

/* ---------- vastauksen jälkeen ---------- */
function settle(card, q, verdict, solution, info = {}) {
  const ok = verdict === true;
  const near = verdict === "near";
  grade(app.state, card.key, verdict, info);
  app.save();
  total++;
  if (ok) right++;
  else {
    requeue(q);
    if (!near) missed.push(card);
  }

  const note = card.note ? `<span class="note">${escapeHtml(card.note)}</span>` : "";
  const vd = el("vd");
  if (vd) {
    if (ok) {
      vd.innerHTML = info.slip
        ? `<span class="vt ok">Bravo!</span><span class="note">Aksentit: <b>${escapeHtml(info.slip)}</b></span>`
        : `<span class="vt ok">Bravo!</span>${note}`;
    } else if (near) {
      vd.innerHTML = `<span class="vt near">Melkein — yksi kirjain</span><span class="sol">${escapeHtml(solution)}</span>${note}`;
    } else {
      const why = info.err && MISS_HINTS[info.err] ? `<span class="note">${MISS_HINTS[info.err]}</span>` : note;
      vd.innerHTML = `<span class="vt no">Oikea vastaus</span><span class="sol">${escapeHtml(solution)}</span>${why}`;
    }
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

  const uniq = [...new Map(missed.map((c) => [c.key, c])).values()].slice(0, 6);
  const recap = uniq.length
    ? `<div class="panel" style="text-align:left"><span class="eyebrow">Nämä jäivät kaivelemaan</span>
        <div class="wordlist" style="margin-top:4px">${uniq
          .map(
            (c) =>
              `<div class="row"><span class="l">${escapeHtml(c.it)}</span><span class="r">${escapeHtml(c.fi)}</span><span></span></div>`,
          )
          .join("")}</div></div>`
    : "";

  el("dStage").innerHTML = `<div class="reveal">
    <span class="eyebrow">Sessio päättyi</span>
    <h2 style="font-family:'Bodoni Moda',Georgia,serif;font-weight:400;font-size:2rem">${msg}</h2>
    <div class="grid2" style="margin-top:6px">
      <div class="stat"><div class="v">${right}/${total}</div><div class="l">oikein</div></div>
      <div class="stat"><div class="v">${streak(app.state)}</div><div class="l">päivän putki</div></div>
    </div>
  </div>${recap}`;
  el("dCount").textContent = `${total}/${total}`;
  el("dFoot").innerHTML = `<button class="btn ghost" data-action="quit">Takaisin kurssiin</button>
    <button class="btn" data-action="more">Vielä lisää</button>`;
  el("dFoot").querySelector('[data-action="quit"]').addEventListener("click", quitDrill);
  el("dFoot").querySelector('[data-action="more"]').addEventListener("click", () => restartSession());
}

/* ================================================================
 * Lauseharjoitus (cloze) — jakson esimerkkilauseet, ei SRS-seurattu.
 * Yksittäinen lause ei ole yksilöity muistettava fakta samalla tavalla
 * kuin sanakortti tai taivutusmuoto, joten tätä ei ajasteta uudelleen;
 * se on lyhyt, toistettava sovellusharjoitus jakson kieliopista.
 * ================================================================ */

let clozeQueue = [];
let clozeIndex = 0;
let clozeAnswered = false;
let clozeRight = 0;

export function startClozeSession(unitIndex) {
  const unit = CURRICULUM[unitIndex];
  if (!unit?.ex?.length) return;
  clozeQueue = shuffle(unit.ex);
  clozeIndex = 0;
  clozeRight = 0;
  el("drill").classList.add("on");
  document.body.style.overflow = "hidden";
  clozeStep();
}

function clozeStep() {
  clozeAnswered = false;
  el("dFoot").innerHTML = "";
  if (clozeIndex >= clozeQueue.length) return clozeFinish();

  el("dBar").style.width = `${(clozeIndex / clozeQueue.length) * 100}%`;
  el("dCount").textContent = `${clozeIndex + 1}/${clozeQueue.length}`;

  const [sentence, answer, note] = clozeQueue[clozeIndex];
  const [before, after] = sentence.split("___");
  const stage = el("dStage");
  stage.innerHTML = `<div class="prompt">
      <span class="eyebrow">Täydennä lause</span>
      <div class="big fi cloze">${escapeHtml(before)}<span class="blank">___</span>${escapeHtml(after || "")}</div>
    </div>
    <input class="typed" id="tin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="täytä aukko">
    <div class="verdict" id="vd"></div>
    <div class="kbd">Enter tarkista</div>`;

  const input = el("tin");
  setTimeout(() => input.focus(), 40);
  el("dFoot").innerHTML = '<button class="btn" data-action="check">Tarkista</button>';

  const check = () => {
    if (clozeAnswered) return;
    clozeAnswered = true;
    const raw = input.value;
    const ok = norm(raw) === norm(answer);
    const near = !ok && isTypo(raw, [answer]);

    input.disabled = true;
    input.classList.add(ok ? "right" : near ? "near" : "wrong");
    if (ok) clozeRight++;

    const vd = el("vd");
    const noteHtml = note ? `<span class="note">${escapeHtml(note)}</span>` : "";
    vd.innerHTML = ok
      ? `<span class="vt ok">Bravo!</span>${noteHtml}`
      : near
        ? `<span class="vt near">Melkein — yksi kirjain</span><span class="sol">${escapeHtml(answer)}</span>${noteHtml}`
        : `<span class="vt no">Oikea vastaus</span><span class="sol">${escapeHtml(answer)}</span>${noteHtml}`;

    const last = clozeIndex + 1 >= clozeQueue.length;
    el("dFoot").innerHTML = `<button class="btn" data-action="next">${last ? "Valmis" : "Seuraava"}</button>`;
    const btn = el("dFoot").querySelector('[data-action="next"]');
    btn.addEventListener("click", () => {
      clozeIndex++;
      clozeStep();
    });
    btn.focus({ preventScroll: true });
  };

  el("dFoot").querySelector("[data-action]").addEventListener("click", check);
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (clozeAnswered) {
      const n = el("dFoot").querySelector('[data-action="next"]');
      if (n) n.click();
    } else check();
  });
}

function clozeFinish() {
  el("dBar").style.width = "100%";
  const pct = clozeQueue.length ? Math.round((clozeRight / clozeQueue.length) * 100) : 0;
  const msg = pct >= 90 ? "Perfetto." : pct >= 70 ? "Bene." : "Jatka samaan malliin.";
  el("dStage").innerHTML = `<div class="reveal">
    <span class="eyebrow">Lauseet käyty läpi</span>
    <h2 style="font-family:'Bodoni Moda',Georgia,serif;font-weight:400;font-size:2rem">${msg}</h2>
    <div class="stat" style="margin:0 auto;max-width:160px"><div class="v">${clozeRight}/${clozeQueue.length}</div><div class="l">oikein</div></div>
  </div>`;
  el("dCount").textContent = `${clozeQueue.length}/${clozeQueue.length}`;
  el("dFoot").innerHTML = `<button class="btn ghost" data-action="quit">Takaisin jaksoon</button>
    <button class="btn" data-action="more">Uudestaan</button>`;
  el("dFoot").querySelector('[data-action="quit"]').addEventListener("click", quitDrill);
  el("dFoot").querySelector('[data-action="more"]').addEventListener("click", () => {
    clozeQueue = shuffle(clozeQueue);
    clozeIndex = 0;
    clozeRight = 0;
    clozeStep();
  });
}

/* ================================================================
 * Verbitaivutus — SRS-seurattu, samalla laatikko/väli-mekanismilla
 * kuin sanasto (ks. data/verbs.js). Avaimet ovat muotoa "parlare|noi",
 * eivätkä osu yhteen sanastoavainten kanssa.
 * ================================================================ */

const VERB_GOAL = 16;

export function startVerbSession(inf = null) {
  const s = app.state;
  const pool = inf ? VERB_CARDS.filter((c) => c.inf === inf).map((c) => c.key) : VERB_CARDS.map((c) => c.key);
  const list = buildQueue(pool, Math.min(VERB_GOAL, pool.length), {});
  if (!list.length) return;

  queue = list.map((k) => ({ key: k, mode: isNew(s, k) ? "verbIntro" : "verbType", retry: 0, source: "verb" }));
  index = 0;
  right = 0;
  total = 0;
  missed = [];
  restartSession = () => startVerbSession(inf);
  el("drill").classList.add("on");
  document.body.style.overflow = "hidden";
  verbStep();
}

function verbStep() {
  answered = false;
  el("dFoot").innerHTML = "";
  if (index >= queue.length) return finish();

  el("dBar").style.width = `${(index / queue.length) * 100}%`;
  el("dCount").textContent = `${index + 1}/${queue.length}`;

  const q = queue[index];
  const card = VERB_BY_KEY.get(q.key);
  if (q.mode === "verbIntro") viewVerbIntro(card, q);
  else viewVerbType(card, q);
}

function viewVerbIntro(card, q) {
  const stage = el("dStage");
  stage.innerHTML = `<div class="reveal">
    <span class="eyebrow">Uusi taivutusmuoto</span>
    <div class="prompt"><div class="big">${escapeHtml(card.it)}</div></div>
    <div style="font-size:1.15rem;font-weight:500">${escapeHtml(card.fi)}</div>
    <div class="verdict"><span class="note">${escapeHtml(card.note)}</span></div>
    ${speakerButton(card.it)}
  </div>`;
  bindSpeak(stage);
  el("dFoot").innerHTML = '<button class="btn" data-action="go">Jatka</button>';
  el("dFoot").querySelector("[data-action]").addEventListener("click", () => {
    introduce(app.state, card.key);
    app.save();
    queue[index].mode = "verbType";
    verbStep();
  });
  if (hasItalianVoice()) setTimeout(() => say(card.it), 220);
}

function viewVerbType(card, q) {
  const stage = el("dStage");
  stage.innerHTML = `<div class="prompt">
      <span class="eyebrow">Taivuta italiaksi</span>
      <div class="big fi">${escapeHtml(card.fi)}</div>
      <div class="hint">${escapeHtml(card.note)}</div>
    </div>
    <input class="typed" id="tin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="italiaksi">
    <div class="verdict" id="vd"></div>
    <div class="kbd">Enter tarkista</div>`;

  const input = el("tin");
  setTimeout(() => input.focus(), 40);
  el("dFoot").innerHTML = '<button class="btn" data-action="check">Tarkista</button>';

  const check = () => {
    if (answered) return;
    answered = true;
    const raw = input.value;
    const v = norm(raw);
    const ok = v === norm(card.it);
    const near = !ok && isTypo(raw, [card.it]);
    const verdict = ok ? true : near ? "near" : false;

    input.disabled = true;
    input.classList.add(ok ? "right" : near ? "near" : "wrong");
    say(card.it);

    grade(app.state, card.key, verdict, { mode: "verb" });
    app.save();
    total++;
    if (ok) right++;
    else {
      requeue(q);
      if (!near) missed.push(card);
    }

    const vd = el("vd");
    vd.innerHTML = ok
      ? `<span class="vt ok">Bravo!</span>`
      : near
        ? `<span class="vt near">Melkein — yksi kirjain</span><span class="sol">${escapeHtml(card.it)}</span>`
        : `<span class="vt no">Oikea vastaus</span><span class="sol">${escapeHtml(card.it)}</span>`;
    const last = index + 1 >= queue.length;
    el("dFoot").innerHTML = `<button class="btn" data-action="next">${last ? "Valmis" : "Seuraava"}</button>`;
    const btn = el("dFoot").querySelector('[data-action="next"]');
    btn.addEventListener("click", () => {
      index++;
      verbStep();
    });
    btn.focus({ preventScroll: true });
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

/* ================================================================
 * Suku — il/la (SRS-seurattu, avaimet "sana|gender" jotta eivät osu
 * yhteen sanan omaa muistamista seuraavan avaimen kanssa: artikkelin
 * osaaminen ja sanan kirjoitusasun osaaminen ovat eri taitoja).
 * ================================================================ */

const GENDER_GOAL = 16;

export function genderPool(cards) {
  return cards.filter((c) => genderOf(c));
}

export function startGenderSession(unitIndex = null) {
  const s = app.state;
  const cards = unitIndex == null ? CARDS : CURRICULUM[unitIndex].keys.map((k) => BY_KEY.get(k));
  const eligible = genderPool(cards);
  if (!eligible.length) return;
  const pool = eligible.map((c) => `${c.key}|gender`);
  const list = buildQueue(pool, Math.min(GENDER_GOAL, pool.length), {});
  if (!list.length) return;

  queue = list.map((k) => ({ key: k, mode: "genderChoice", retry: 0, source: "gender" }));
  index = 0;
  right = 0;
  total = 0;
  missed = [];
  restartSession = () => startGenderSession(unitIndex);
  el("drill").classList.add("on");
  document.body.style.overflow = "hidden";
  genderStep();
}

function genderStep() {
  answered = false;
  el("dFoot").innerHTML = "";
  if (index >= queue.length) return finish();

  el("dBar").style.width = `${(index / queue.length) * 100}%`;
  el("dCount").textContent = `${index + 1}/${queue.length}`;

  const q = queue[index];
  const cardKey = q.key.slice(0, q.key.lastIndexOf("|gender"));
  const card = BY_KEY.get(cardKey);
  viewGenderChoice(card, q);
}

function viewGenderChoice(card, q) {
  const gender = genderOf(card);
  const stage = el("dStage");
  stage.innerHTML = `<div class="prompt">
      <span class="eyebrow">Il vai la?</span>
      <div class="big fi">${escapeHtml(dropArticle(card.it))}</div>
      <div class="hint">${escapeHtml(card.fi)}</div>
    </div>
    <div class="opts gender2">
      <button class="opt" data-g="m"><span>il / un</span></button>
      <button class="opt" data-g="f"><span>la / una</span></button>
    </div>
    <div class="verdict" id="vd"></div>`;

  const buttons = [...stage.querySelectorAll(".opt")];
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      const ok = b.dataset.g === gender;
      buttons.forEach((x) => (x.disabled = true));
      b.classList.add(ok ? "right" : "wrong");
      if (!ok) buttons.find((x) => x.dataset.g === gender).classList.add("right");
      say(card.it);

      grade(app.state, q.key, ok, { mode: "gender" });
      app.save();
      total++;
      if (ok) right++;
      else {
        requeue(q);
        missed.push(card);
      }

      const vd = el("vd");
      vd.innerHTML = ok
        ? `<span class="vt ok">Bravo!</span>`
        : `<span class="vt no">Oikea vastaus</span><span class="sol">${escapeHtml(card.it)}</span>`;
      const last = index + 1 >= queue.length;
      el("dFoot").innerHTML = `<button class="btn" data-action="next">${last ? "Valmis" : "Seuraava"}</button>`;
      const btn = el("dFoot").querySelector('[data-action="next"]');
      btn.addEventListener("click", () => {
        index++;
        genderStep();
      });
      btn.focus({ preventScroll: true });
    }),
  );
}

/* ---------- näppäimistö ---------- */
export function initDrill() {
  el("dQuit").addEventListener("click", quitDrill);

  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") return quitDrill();

    const q = queue[index];
    // Sanelussa (listen) välilyönti kirjoittaa välilyönnin kenttään — ei toista.
    if (e.key === " " && q && q.mode === "recall") {
      e.preventDefault();
      if (flip) flip();
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
