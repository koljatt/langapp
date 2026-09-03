/**
 * Sanaston tarkistus: aja `npm run check` kun lisäät tai muokkaat sanoja.
 * Kaatuu, jos jokin jakso on rikki — muuten tulostaa yhteenvedon.
 */

import { CURRICULUM, CARDS } from "../src/data/index.js";
import { VERB_CARDS } from "../src/data/verbs.js";

let errors = 0;
const fail = (msg) => {
  console.error("VIRHE:", msg);
  errors++;
};

for (const unit of CURRICULUM) {
  for (const field of ["id", "stage", "title", "it", "grammar"]) {
    if (!unit[field]) fail(`jakso ${unit.n}: kenttä "${field}" puuttuu`);
  }
  if (!Array.isArray(unit.items) || unit.items.length < 5) {
    fail(`jakso ${unit.n} (${unit.title}): liian vähän sanoja`);
  }
  const seen = new Set();
  for (const item of unit.items) {
    if (!Array.isArray(item) || item.length < 2 || !item[0] || !item[1]) {
      fail(`jakso ${unit.n}: virheellinen rivi ${JSON.stringify(item)}`);
      continue;
    }
    const key = `${item[0]}|${item[1]}`;
    if (seen.has(key)) fail(`jakso ${unit.n}: sama sana kahdesti — ${item[0]}`);
    seen.add(key);
  }
  if (unit.ex != null) {
    if (!Array.isArray(unit.ex) || !unit.ex.length) {
      fail(`jakso ${unit.n}: ex on tyhjä tai ei taulukko`);
    } else {
      for (const row of unit.ex) {
        if (!Array.isArray(row) || !row[0] || !row[1]) {
          fail(`jakso ${unit.n}: virheellinen ex-rivi ${JSON.stringify(row)}`);
          continue;
        }
        if (!row[0].includes("___")) {
          fail(`jakso ${unit.n}: ex-lauseesta puuttuu aukko (___) — "${row[0]}"`);
        }
      }
    }
  }
}

const ids = CURRICULUM.map((u) => u.id);
if (new Set(ids).size !== ids.length) fail("jaksojen id-tunnukset eivät ole uniikkeja");

if (new Set(VERB_CARDS.map((c) => c.key)).size !== VERB_CARDS.length) {
  fail("verbitaivutuksen avaimet eivät ole uniikkeja");
}
for (const c of VERB_CARDS) {
  if (!c.it || !c.fi) fail(`verbikortti ${c.key}: puuttuva it/fi`);
}

const perUnit = CURRICULUM.map((u) => `${String(u.n).padStart(2, "0")} ${u.title} — ${u.items.length}`);
console.log(perUnit.join("\n"));
console.log(`\n${CURRICULUM.length} jaksoa, ${CARDS.length} uniikkia korttia, ${VERB_CARDS.length} verbitaivutuskorttia`);

if (errors) {
  console.error(`\n${errors} virhettä.`);
  process.exit(1);
}
console.log("Sanasto kunnossa.");
