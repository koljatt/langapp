import { app, el } from "../app.js";
import { CURRICULUM, BY_KEY } from "../data/index.js";
import { boxOf, isStruggling, unitStats, KNOWN_BOX } from "../lib/srs.js";
import { escapeHtml } from "../lib/text.js";
import { say, hasItalianVoice } from "../lib/speech.js";
import { SPEAKER } from "./icons.js";
import { startSession, startClozeSession, startGenderSession, genderPool } from "./drill.js";

export function renderUnit() {
  const s = app.state;
  const u = CURRICULUM[app.unitIndex];
  const st = unitStats(s, u);
  const genderCount = genderPool(u.keys.map((k) => BY_KEY.get(k)).filter(Boolean)).length;

  let h = '<button class="back" data-action="back">&larr; Kurssi</button>';
  h += `<div>
    <span class="eyebrow">${escapeHtml(u.stage)} · jakso ${String(u.n).padStart(2, "0")}</span>
    <h2 style="font-size:1.5rem;margin-top:4px">${escapeHtml(u.title)}</h2>
    <p style="font-family:'Bodoni Moda',Georgia,serif;font-style:italic;color:var(--muted)">${escapeHtml(u.it)}</p>
  </div>`;
  h += `<div class="meter${st.pct >= 0.999 ? " ok" : ""}"><span style="width:${st.pct * 100}%"></span></div>`;
  h += `<div class="eyebrow num">${st.known} / ${st.total} osattu${st.due ? ` · ${st.due} kerrattavaa` : ""}${st.hard ? ` · ${st.hard} kompastuskiveä` : ""}</div>`;
  h += `<div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn" data-action="practice">Harjoittele tätä jaksoa</button>
    ${st.hard >= 3 ? '<button class="btn ghost" data-action="hard">Vain vaikeat</button>' : ""}
    ${u.ex?.length ? '<button class="btn ghost" data-action="cloze">Harjoittele lauseita</button>' : ""}
    ${genderCount >= 3 ? '<button class="btn ghost" data-action="gender">Il vai la?</button>' : ""}
  </div>`;
  h += `<div class="panel"><span class="eyebrow">Kielioppi</span><div class="gram" style="margin-top:10px">${u.grammar}</div></div>`;

  h += '<div class="panel"><span class="eyebrow">Sanasto</span><div class="wordlist" style="margin-top:6px">';
  for (const [it, fi, note] of u.items) {
    const key = `${it}|${fi}`;
    const b = boxOf(s, key);
    const tough = isStruggling(s, key);
    const cls = tough ? "hard" : b < 0 ? "" : b < 2 ? "l1" : b < KNOWN_BOX ? "l2" : "l3";
    const level = tough ? "kompastuskivi" : b < 0 ? "ei vielä aloitettu" : `laatikko ${b}`;
    h += `<div class="row">
      <span class="l">${escapeHtml(it)}</span>
      <span class="r">${escapeHtml(fi)}${note ? `<small>${escapeHtml(note)}</small>` : ""}</span>
      <span style="display:flex;align-items:center;gap:8px">
        <span class="dot ${cls}" title="${level}"></span>
        ${hasItalianVoice() ? `<button class="spk" data-say="${escapeHtml(it)}" aria-label="Kuuntele: ${escapeHtml(it)}">${SPEAKER()}</button>` : ""}
      </span>
    </div>`;
  }
  h += "</div></div>";

  const host = el("vUnit");
  host.innerHTML = h;
  host.querySelector('[data-action="back"]').addEventListener("click", () => app.goto("home"));
  host.querySelector('[data-action="practice"]').addEventListener("click", () => startSession(app.unitIndex));
  const focus = host.querySelector('[data-action="hard"]');
  if (focus) focus.addEventListener("click", () => startSession(app.unitIndex, { focus: "hard" }));
  const cloze = host.querySelector('[data-action="cloze"]');
  if (cloze) cloze.addEventListener("click", () => startClozeSession(app.unitIndex));
  const gender = host.querySelector('[data-action="gender"]');
  if (gender) gender.addEventListener("click", () => startGenderSession(app.unitIndex));
  host.querySelectorAll("[data-say]").forEach((b) => b.addEventListener("click", () => say(b.dataset.say)));
}
