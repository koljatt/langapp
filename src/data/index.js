import stage1 from "./stage-1-ensiaskeleet.js";
import stage2 from "./stage-2-arki.js";
import stage3 from "./stage-3-kaupungilla.js";
import stage4 from "./stage-4-ilmaisu.js";

/**
 * Koko A1-kurssi järjestyksessä. Uusi jakso lisätään sopivaan
 * vaihetiedostoon (tai omaan tiedostoonsa, joka importataan tähän).
 */
export const CURRICULUM = [...stage1, ...stage2, ...stage3, ...stage4];

CURRICULUM.forEach((unit, i) => {
  unit.n = i + 1;
});

/**
 * Yksi kortti per uniikki (italia, suomi) -pari. Sama sana voi esiintyä
 * useassa jaksossa — silloin se on yksi kortti, joka kuuluu molempiin.
 */
export const CARDS = [];
export const BY_KEY = new Map();

for (const unit of CURRICULUM) {
  unit.keys = [];
  for (const [it, fi, note] of unit.items) {
    const key = `${it}|${fi}`;
    let card = BY_KEY.get(key);
    if (!card) {
      card = { key, it, fi, note: note || "", units: [] };
      BY_KEY.set(key, card);
      CARDS.push(card);
    }
    if (!card.units.includes(unit.n - 1)) card.units.push(unit.n - 1);
    unit.keys.push(key);
  }
}

/** Jaksot ryhmiteltyinä vaiheiksi (A1.1 … A1.4). */
export const STAGES = [];
for (const unit of CURRICULUM) {
  const found = STAGES.find((s) => s.name === unit.stage);
  if (found) found.units.push(unit);
  else STAGES.push({ name: unit.stage, units: [unit] });
}
