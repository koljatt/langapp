import { app, el } from "../app.js";
import { VERB_CARDS, VERB_GROUPS, VERB_GROUP_LABEL, VERB_INFO } from "../data/verbs.js";
import { boxOf, dueKeys, KNOWN_BOX } from "../lib/srs.js";
import { escapeHtml } from "../lib/text.js";
import { startVerbSession } from "./drill.js";

const PERSONS = ["io", "tu", "lui", "noi", "voi", "loro"];

function verbStats(s, v) {
  let known = 0;
  let due = 0;
  let started = 0;
  for (const p of PERSONS) {
    const key = `${v.inf}|${p}`;
    const b = boxOf(s, key);
    if (b >= 0) started++;
    if (b >= KNOWN_BOX) known++;
  }
  due = dueKeys(s, PERSONS.map((p) => `${v.inf}|${p}`)).length;
  return { known, due, started, total: PERSONS.length };
}

export function renderVerbs() {
  const s = app.state;
  const allDue = dueKeys(s, VERB_CARDS.map((c) => c.key)).length;

  let h = '<div class="hero">';
  h += '<div><span class="eyebrow">Verbitaivutus</span><h2>Kaikki persoonat, ei vain ne joita sanasto kysyy</h2></div>';
  h += `<p class="sub">Curriculum opettaa esim. "faccio" mutta ei "fate" — tässä on koko taivutus, samalla kertausjärjestelmällä kuin sanasto.</p>`;
  if (allDue > 0) h += `<div class="sub num">${allDue} taivutusmuotoa odottaa kertausta</div>`;
  h += '<button class="btn" data-action="all">Sekoitettu harjoitus</button>';
  h += "</div>";

  for (const g of VERB_GROUPS) {
    h += `<div class="stagehead"><span class="eyebrow">${escapeHtml(VERB_GROUP_LABEL[g.group] || g.group)}</span><hr></div><div class="units">`;
    for (const inf of g.infs) {
      const info = VERB_INFO.get(inf) || { fi: "", label: inf };
      const st = verbStats(s, { inf });
      const right = st.due
        ? `<span class="badge" title="${st.due} kerrattavaa">${st.due}</span>`
        : `<span class="badge muted">${st.known}/${st.total}</span>`;
      h += `<button class="unit noidx${st.known >= st.total ? " done" : ""}" data-inf="${escapeHtml(inf)}">
        <span><span class="tt">${escapeHtml(info.label)}</span><br><span class="it">${escapeHtml(info.fi)}</span></span>
        ${right}
      </button>`;
    }
    h += "</div>";
  }

  const host = el("vVerbs");
  host.innerHTML = h;
  host.querySelector('[data-action="all"]').addEventListener("click", () => startVerbSession());
  host.querySelectorAll("[data-inf]").forEach((b) =>
    b.addEventListener("click", () => startVerbSession(b.dataset.inf)),
  );
}
