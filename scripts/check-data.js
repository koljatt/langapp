/**
 * Sanaston tarkistus: aja `npm run check` kun lisäät tai muokkaat sanoja.
 * Kaatuu, jos jokin jakso on rikki — muuten tulostaa yhteenvedon.
 */

import { CURRICULUM, CARDS } from "../src/data/index.js";

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
}

const ids = CURRICULUM.map((u) => u.id);
if (new Set(ids).size !== ids.length) fail("jaksojen id-tunnukset eivät ole uniikkeja");

const perUnit = CURRICULUM.map((u) => `${String(u.n).padStart(2, "0")} ${u.title} — ${u.items.length}`);
console.log(perUnit.join("\n"));
console.log(`\n${CURRICULUM.length} jaksoa, ${CARDS.length} uniikkia korttia`);

if (errors) {
  console.error(`\n${errors} virhettä.`);
  process.exit(1);
}
console.log("Sanasto kunnossa.");
