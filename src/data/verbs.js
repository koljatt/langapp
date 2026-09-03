/**
 * Verbitaivutus omana korttisarjanaan. Curriculum-sanasto opettaa vain
 * osan persoonamuodoista kustakin verbistä (esim. "faccio" mutta ei
 * "fate") — tämä täydentää koko taivutuksen ja tarjoaa oman harjoituksen.
 *
 * Jokainen taivutusmuoto on oma SRS-seurattava kortti, avaimella
 * `infinitiivi|persoona` (esim. "parlare|noi"), samalla laatikko/väli-
 * mekanismilla kuin sanastokorteilla (ks. lib/srs.js — dueKeys/grade
 * hyväksyvät minkä tahansa avainjoukon, joten tämä ei vaadi muutoksia
 * ajastimeen).
 *
 * Rajaus: passato prossimo -taivutus kattaa vain avere-apuverbilliset
 * verbit. Essere-verbien partisiippi taipuu tekijän suvun mukaan
 * (sono andato / sono andata), eikä sitä voi taivuttaa oikein pelkän
 * persoonan perusteella — väärä oletus opettaisi virheellistä italiaa,
 * joten nuo jäävät pois tästä harjoituksesta.
 */

const PERSONS = ["io", "tu", "lui", "noi", "voi", "loro"];
const PERSON_LABEL = { io: "minä", tu: "sinä", lui: "hän", noi: "me", voi: "te", loro: "he" };

/** [inf, suomennos, ryhmä, [io,tu,lui,noi,voi,loro] italiaksi, [...] suomeksi] */
const RAW = [
  // -are, säännöllinen
  ["lavorare", "tehdä töitä", "are",
    ["lavoro", "lavori", "lavora", "lavoriamo", "lavorate", "lavorano"],
    ["teen töitä", "teet töitä", "tekee töitä", "teemme töitä", "teette töitä", "tekevät töitä"]],
  ["studiare", "opiskella", "are",
    ["studio", "studi", "studia", "studiamo", "studiate", "studiano"],
    ["opiskelen", "opiskelet", "opiskelee", "opiskelemme", "opiskelette", "opiskelevat"]],
  ["mangiare", "syödä", "are",
    ["mangio", "mangi", "mangia", "mangiamo", "mangiate", "mangiano"],
    ["syön", "syöt", "syö", "syömme", "syötte", "syövät"]],

  // -ere, säännöllinen
  ["leggere", "lukea", "ere",
    ["leggo", "leggi", "legge", "leggiamo", "leggete", "leggono"],
    ["luen", "luet", "lukee", "luemme", "luette", "lukevat"]],
  ["scrivere", "kirjoittaa", "ere",
    ["scrivo", "scrivi", "scrive", "scriviamo", "scrivete", "scrivono"],
    ["kirjoitan", "kirjoitat", "kirjoittaa", "kirjoitamme", "kirjoitatte", "kirjoittavat"]],
  ["vedere", "nähdä", "ere",
    ["vedo", "vedi", "vede", "vediamo", "vedete", "vedono"],
    ["näen", "näet", "näkee", "näemme", "näette", "näkevät"]],

  // -ire, säännöllinen
  ["dormire", "nukkua", "ire",
    ["dormo", "dormi", "dorme", "dormiamo", "dormite", "dormono"],
    ["nukun", "nukut", "nukkuu", "nukumme", "nukutte", "nukkuvat"]],
  ["partire", "lähteä", "ire",
    ["parto", "parti", "parte", "partiamo", "partite", "partono"],
    ["lähden", "lähdet", "lähtee", "lähdemme", "lähdette", "lähtevät"]],
  ["aprire", "avata", "ire",
    ["apro", "apri", "apre", "apriamo", "aprite", "aprono"],
    ["avaan", "avaat", "avaa", "avaamme", "avaatte", "avaavat"]],

  // -ire, -isc-ryhmä
  ["capire", "ymmärtää", "isc",
    ["capisco", "capisci", "capisce", "capiamo", "capite", "capiscono"],
    ["ymmärrän", "ymmärrät", "ymmärtää", "ymmärrämme", "ymmärrätte", "ymmärtävät"]],
  ["finire", "lopettaa", "isc",
    ["finisco", "finisci", "finisce", "finiamo", "finite", "finiscono"],
    ["lopetan", "lopetat", "lopettaa", "lopetamme", "lopetatte", "lopettavat"]],
  ["preferire", "pitää parempana", "isc",
    ["preferisco", "preferisci", "preferisce", "preferiamo", "preferite", "preferiscono"],
    ["pidän parempana", "pidät parempana", "pitää parempana", "pidämme parempana", "pidätte parempana", "pitävät parempana"]],

  // refleksiivit
  ["svegliarsi", "herätä", "refl",
    ["mi sveglio", "ti svegli", "si sveglia", "ci svegliamo", "vi svegliate", "si svegliano"],
    ["herään", "heräät", "herää", "heräämme", "heräätte", "heräävät"]],
  ["lavarsi", "peseytyä", "refl",
    ["mi lavo", "ti lavi", "si lava", "ci laviamo", "vi lavate", "si lavano"],
    ["peseydyn", "peseydyt", "peseytyy", "peseydymme", "peseydytte", "peseytyvät"]],
  ["vestirsi", "pukeutua", "refl",
    ["mi vesto", "ti vesti", "si veste", "ci vestiamo", "vi vestite", "si vestono"],
    ["pukeudun", "pukeudut", "pukeutuu", "pukeudumme", "pukeudutte", "pukeutuvat"]],

  // epäsäännölliset
  ["essere", "olla", "irr",
    ["sono", "sei", "è", "siamo", "siete", "sono"],
    ["olen", "olet", "on", "olemme", "olette", "ovat"]],
  ["avere", "omistaa", "irr",
    ["ho", "hai", "ha", "abbiamo", "avete", "hanno"],
    ["minulla on", "sinulla on", "hänellä on", "meillä on", "teillä on", "heillä on"]],
  ["andare", "mennä", "irr",
    ["vado", "vai", "va", "andiamo", "andate", "vanno"],
    ["menen", "menet", "menee", "menemme", "menette", "menevät"]],
  ["venire", "tulla", "irr",
    ["vengo", "vieni", "viene", "veniamo", "venite", "vengono"],
    ["tulen", "tulet", "tulee", "tulemme", "tulette", "tulevat"]],
  ["fare", "tehdä", "irr",
    ["faccio", "fai", "fa", "facciamo", "fate", "fanno"],
    ["teen", "teet", "tekee", "teemme", "teette", "tekevät"]],
  ["potere", "voida, saada", "irr",
    ["posso", "puoi", "può", "possiamo", "potete", "possono"],
    ["voin", "voit", "voi", "voimme", "voitte", "voivat"]],
  ["volere", "haluta", "irr",
    ["voglio", "vuoi", "vuole", "vogliamo", "volete", "vogliono"],
    ["haluan", "haluat", "haluaa", "haluamme", "haluatte", "haluavat"]],
  ["dovere", "täytyä", "irr",
    ["devo", "devi", "deve", "dobbiamo", "dovete", "devono"],
    ["minun täytyy", "sinun täytyy", "hänen täytyy", "meidän täytyy", "teidän täytyy", "heidän täytyy"]],
];

/** Passato prossimo, avere-apuverbilliset verbit — ks. tiedoston alun huomautus. */
const RAW_PASSATO = [
  ["mangiare", "syödä", "mangiato",
    ["söin", "söit", "söi", "söimme", "söitte", "söivät"]],
  ["leggere", "lukea", "letto",
    ["luin", "luit", "luki", "luimme", "luitte", "lukivat"]],
  ["vedere", "nähdä", "visto",
    ["näin", "näit", "näki", "näimme", "näitte", "näkivät"]],
  ["fare", "tehdä", "fatto",
    ["tein", "teit", "teki", "teimme", "teitte", "tekivät"]],
];
const AVERE = ["ho", "hai", "ha", "abbiamo", "avete", "hanno"];

export const VERBS = RAW.map(([inf, fi, group, it, fiForms]) => ({ inf, fi, group, it, fiForms }));

/** infinitiivi (myös "pp:"-etuliitteiset) -> { fi, label } valintanäkymää varten. */
export const VERB_INFO = new Map();
for (const v of RAW) VERB_INFO.set(v[0], { fi: v[1], label: v[0] });
for (const [inf, fi] of RAW_PASSATO) VERB_INFO.set(`pp:${inf}`, { fi, label: `${inf} (p.p.)` });

export const VERB_GROUP_LABEL = {
  are: "-are, säännöllinen",
  ere: "-ere, säännöllinen",
  ire: "-ire, säännöllinen",
  isc: "-ire, -isc-ryhmä",
  refl: "Refleksiiviverbit",
  irr: "Epäsäännölliset",
  pp: "Mennyt aika (passato prossimo)",
};

export const VERB_CARDS = [];
export const VERB_BY_KEY = new Map();

for (const v of VERBS) {
  for (let i = 0; i < PERSONS.length; i++) {
    const p = PERSONS[i];
    const key = `${v.inf}|${p}`;
    const card = {
      key,
      it: v.it[i],
      fi: v.fiForms[i],
      note: `${v.inf} (${v.fi}) · ${PERSON_LABEL[p]}`,
      inf: v.inf,
      person: p,
      group: v.group,
    };
    VERB_BY_KEY.set(key, card);
    VERB_CARDS.push(card);
  }
}

for (const [inf, fi, participle, fiForms] of RAW_PASSATO) {
  for (let i = 0; i < PERSONS.length; i++) {
    const p = PERSONS[i];
    const key = `pp:${inf}|${p}`;
    const card = {
      key,
      it: `${AVERE[i]} ${participle}`,
      fi: fiForms[i],
      note: `${inf} (${fi}) · passato prossimo · ${PERSON_LABEL[p]}`,
      inf: `pp:${inf}`,
      person: p,
      group: "pp",
    };
    VERB_BY_KEY.set(key, card);
    VERB_CARDS.push(card);
  }
}

/** Verbit ryhmiteltyinä valintanäkymää varten. */
export const VERB_GROUPS = [];
for (const c of VERB_CARDS) {
  let g = VERB_GROUPS.find((x) => x.group === c.group);
  if (!g) {
    g = { group: c.group, label: VERB_GROUP_LABEL[c.group], infs: [] };
    VERB_GROUPS.push(g);
  }
  if (!g.infs.includes(c.inf)) g.infs.push(c.inf);
}
