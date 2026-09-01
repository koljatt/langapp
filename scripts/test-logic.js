/**
 * Kevyt yksikkötesti ilman riippuvuuksia: `npm test`.
 * Kattaa vastausten hyväksymislogiikan ja kertausaikataulun.
 */

let failed = 0;
import { CARDS, BY_KEY, CURRICULUM } from '../src/data/index.js';
import { acceptedForms, dropArticle, finnishForms, norm } from '../src/lib/text.js';
import { grade, boxOf, isDue, INTERVALS, KNOWN_BOX, openCount, unitStats } from '../src/lib/srs.js';
import { defaultState } from '../src/lib/store.js';

const check = (name, got, want) => {
  const pass = got === want;
  if (!pass) failed++;
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}  → ${got}${pass ? '' : ` (odotettu ${want})`}`);
};

// accent + article tolerance
const caffe = CARDS.find(c=>c.it==='il caffè');
check('caffe hyväksytään', acceptedForms(caffe).has(norm('caffe')), true);
check('il caffè hyväksytään', acceptedForms(caffe).has(norm('Il Caffè')), true);
check('perché-tyyppinen', acceptedForms(CARDS.find(c=>c.it==='perché?')).has(norm('perche')), true);
// several italian answers for one finnish prompt
const scusa = CARDS.find(c=>c.it==='scusa'), scusi = CARDS.find(c=>c.it==='scusi');
check('scusa/scusi sama suomi', norm(scusa.fi)===norm(scusi.fi), true);
check('"scusi" kelpaa kun kysyttiin scusa', CARDS.some(x=>norm(x.fi)===norm(scusa.fi)&&acceptedForms(x).has(norm('scusi'))), true);
// finnish alternatives
const zio = CARDS.find(c=>c.it==='lo zio');
check('"eno" kelpaa (setä, eno)', finnishForms(zio).has(norm('eno')), true);
check('roska ei kelpaa', finnishForms(zio).has(norm('traktori')), false);

// scheduler
const s = defaultState();
const k = CARDS[0].key;
grade(s,k,true); check('1. oikein → laatikko 1', boxOf(s,k), 1);
grade(s,k,true); grade(s,k,true); check('3 oikein → laatikko 3', boxOf(s,k), 3);
check('ei kerrattavana heti', isDue(s,k), false);
const dueIn = Math.round((s.items[k].due-Date.now())/86400000);
check('väli 4 pv', dueIn, INTERVALS[3]);
grade(s,k,false); check('väärin → putoaa 2', boxOf(s,k), 1);
check('log kertyi', s.log[Object.keys(s.log)[0]], 4);

// unlocking
const s2 = defaultState();
check('aluksi 1 jakso auki', openCount(s2), 1);
CURRICULUM[0].keys.forEach(key=>{ for(let i=0;i<KNOWN_BOX;i++) grade(s2,key,true); });
check('jakso 1 osattu → 2 auki', openCount(s2), 2);
check('jakso 1 pct', Math.round(unitStats(s2,CURRICULUM[0]).pct*100), 100);

// data integrity
check('kortit uniikkeja', new Set(CARDS.map(c=>c.key)).size, CARDS.length);
check('jokaisella kortilla jakso', CARDS.every(c=>c.units.length>0), true);
check('avaimet löytyvät', CURRICULUM.every(u=>u.keys.every(x=>BY_KEY.has(x))), true);

console.log(failed ? `\n${failed} testiä epäonnistui.` : "\nKaikki testit läpi.");
if (failed) process.exit(1);
