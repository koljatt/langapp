/**
 * Kevyt yksikkötesti ilman riippuvuuksia: `npm test`.
 * Kattaa vastausten hyväksymislogiikan, virheanalyysin ja kertausaikataulun.
 */

let failed = 0;
import { CARDS, BY_KEY, CURRICULUM } from '../src/data/index.js';
import { VERB_CARDS, VERB_BY_KEY, VERBS } from '../src/data/verbs.js';
import { accentSlip, acceptedForms, classifyMiss, finnishForms, genderOf, isTypo, levenshtein, norm } from '../src/lib/text.js';
import { boxOf, difficulty, grade, hardKeys, isDue, isStruggling, openCount, unitStats, weakSpots, INTERVALS, KNOWN_BOX } from '../src/lib/srs.js';
import { defaultState, merge } from '../src/lib/store.js';

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

// virheanalyysi
check('levenshtein', levenshtein('parlare','parlere'), 1);
check('levenshtein katkaisee', levenshtein('a','abcdefghij',2), 3);
check('kaksoiskonsonantti', classifyMiss('piza','pizza'), 'tupla');
check('pääte (suku)', classifyMiss('ragazza','ragazzo'), 'paate');
check('artikkeli', classifyMiss('lo libro','il libro'), 'artikkeli');
check('kirjoitusvirhe', classifyMiss('parlere','parlare'), 'kirjoitus');
check('aivan eri sana', classifyMiss('cane','parlare'), 'eisana');
check('tyhjä vastaus', classifyMiss('','parlare'), 'tyhja');
check('aksentti puuttuu -> vinkki', accentSlip('caffe',['il caffè','caffè']), 'caffè');
check('aksentti kirjoitettu -> ei vinkkiä', accentSlip('caffè',['caffè']), null);
check('yhden kirjaimen lipsahdus', isTypo('parlere','parlare'), true);
check('kaksoiskonsonanttia ei armahdeta', isTypo('piza','pizza'), false);
check('lyhyt sana ei ole lipsahdus', isTypo('can','cane'), false);

// scheduler
const s = defaultState();
const k = CARDS[0].key;
grade(s,k,true); check('1. oikein → laatikko 1', boxOf(s,k), 1);
grade(s,k,true); grade(s,k,true); check('3 oikein → laatikko 3', boxOf(s,k), 3);
check('ei kerrattavana heti', isDue(s,k), false);
const dueIn = Math.round((s.items[k].due-Date.now())/86400000);
check('väli 4 pv', dueIn, INTERVALS[3]);
check('helppouskerroin täysi', s.items[k].e, 1);
grade(s,k,false); check('väärin → putoaa 2', boxOf(s,k), 1);
check('romahdus osatusta kirjautuu', s.items[k].lp, 1);
check('kerroin laski', s.items[k].e < 1, true);
check('log kertyi', s.log[Object.keys(s.log)[0]], 4);

// lipsahdus ei pudota laatikkoa
const sn = defaultState();
const kn = CARDS[1].key;
grade(sn,kn,true); grade(sn,kn,true);
grade(sn,kn,'near');
check('lipsahdus jättää laatikon', boxOf(sn,kn), 2);
check('lipsahdus ei ole virhe', sn.items[kn].miss, 0);
check('lipsahdus tiivistää väliä', sn.items[kn].e < 1, true);

// mukautuva väli: sama laatikko, eri historia
const sa = defaultState();
const clean = CARDS[2].key, rough = CARDS[3].key;
for (let i=0;i<3;i++) grade(sa,clean,true);
grade(sa,rough,false); grade(sa,rough,false);
for (let i=0;i<3;i++) grade(sa,rough,true);
check('kompasteltu samassa laatikossa', boxOf(sa,rough), boxOf(sa,clean));
check('kompasteltu palaa aiemmin', sa.items[rough].due < sa.items[clean].due, true);

// kompastuskivien tunnistus
check('kompasteltu tunnistetaan', isStruggling(sa,rough), true);
check('puhdas ei ole kompastuskivi', isStruggling(sa,clean), false);
check('vaikeus järjestää', hardKeys(sa,[clean,rough])[0], rough);
check('puhtaan vaikeus 0', difficulty(sa,clean), 0);

// tilastot kertyvät harjoitustavoittain
const sw = defaultState();
for (let i=0;i<6;i++) grade(sw,CARDS[i].key,i>1,{mode:'type',dir:'fi2it',err:i>1?null:'tupla'});
const w = weakSpots(sw);
check('kirjoitustapa tilastoitu', w.modes[0].k, 'type');
check('osumatarkkuus 4/6', Math.round(w.modes[0].pct*100), 67);
check('virhelaji kirjattu', w.errs[0].k, 'tupla');
check('virhelajin määrä', w.errs[0].n, 2);

// vienti/tuonti säilyttää kompastuskivitilastot
const merged = merge(defaultState(), sw);
check('tilastot säilyvät yhdistyksessä', merged.stats.errs.tupla, 2);
check('tilastot eivät kahdennu', merge(sw,sw).stats.errs.tupla, 2);

// unlocking
const s2 = defaultState();
check('aluksi 1 jakso auki', openCount(s2), 1);
CURRICULUM[0].keys.forEach(key=>{ for(let i=0;i<KNOWN_BOX;i++) grade(s2,key,true); });
check('jakso 1 osattu → 2 auki', openCount(s2), 2);
check('jakso 1 pct', Math.round(unitStats(s2,CURRICULUM[0]).pct*100), 100);

// vanha tallennus ilman uusia kenttiä ei kaadu
const old = defaultState();
old.items[k] = { b: 2, due: 0, seen: 4, miss: 1, t: 1 };
grade(old,k,true);
check('vanha kortti saa kertoimen', old.items[k].e, 1);
check('vanha kortti nousee', old.items[k].b, 3);

// suku (il/la)
check('il problema on maskuliini poikkeuksesta huolimatta', genderOf(CARDS.find(c=>c.it==='il problema')), 'm');
check('la mano on feminiini poikkeuksesta huolimatta', genderOf(CARDS.find(c=>c.it==='la mano')), 'f');
check('lo studente (s+konsonantti) on maskuliini', genderOf(CARDS.find(c=>c.it==='lo studente')), 'm');
check("un'amica on feminiini (elisio)", genderOf(CARDS.find(c=>c.it==="un'amica")), 'f');
check("l'acqua on ambivalentti — jää pois", genderOf(CARDS.find(c=>c.it==="l'acqua")), null);
check('monikkoartikkeli (i pantaloni) jää pois', genderOf(CARDS.find(c=>c.it==='i pantaloni')), null);
check('idiomi (un po\') ei ole substantiivi', genderOf(CARDS.find(c=>c.it==="un po'")), null);
check('määrälauseke (un chilo di) ei ole substantiivi', genderOf(CARDS.find(c=>c.it==='un chilo di')), null);
check('pilkullinen lause (il conto, per favore) jää pois', genderOf(CARDS.find(c=>c.it==='il conto, per favore')), null);
check('sana ilman artikkelia jää pois', genderOf(CARDS.find(c=>c.it==='parlare')), null);

// verbitaivutus
check('verbikortit uniikkeja', new Set(VERB_CARDS.map(c=>c.key)).size, VERB_CARDS.length);
check('parlare|noi ei ole verbidatassa (parlare on jo sanastossa)', VERB_BY_KEY.has('parlare|noi'), false);
check('lavorare|noi taipuu oikein', VERB_BY_KEY.get('lavorare|noi').it, 'lavoriamo');
check('essere|tu taipuu oikein', VERB_BY_KEY.get('essere|tu').it, 'sei');
check('passato prossimo käyttää avere-apuverbiä', VERB_BY_KEY.get('pp:mangiare|noi').it, 'abbiamo mangiato');
check('jokaisella verbillä 6 persoonaa', VERBS.every(v=>v.it.length===6 && v.fiForms.length===6), true);
const gVerb = defaultState();
grade(gVerb, 'lavorare|io', true, { mode: 'verb' });
check('verbikortti taipuu samalla SRS:llä kuin sanasto', boxOf(gVerb, 'lavorare|io'), 1);

// data integrity
check('kortit uniikkeja', new Set(CARDS.map(c=>c.key)).size, CARDS.length);
check('jokaisella kortilla jakso', CARDS.every(c=>c.units.length>0), true);
check('avaimet löytyvät', CURRICULUM.every(u=>u.keys.every(x=>BY_KEY.has(x))), true);

console.log(failed ? `\n${failed} testiä epäonnistui.` : "\nKaikki testit läpi.");
if (failed) process.exit(1);
