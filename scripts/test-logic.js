/**
 * Kevyt yksikkötesti ilman riippuvuuksia: `npm test`.
 * Kattaa vastausten hyväksymislogiikan, virheanalyysin ja kertausaikataulun.
 */

let failed = 0;
import { CARDS, BY_KEY, CURRICULUM } from '../src/data/index.js';
import { VERB_CARDS, VERB_BY_KEY, VERBS } from '../src/data/verbs.js';
import { accentSlip, acceptedForms, classifyMiss, finnishForms, genderOf, isTypo, judgeSpoken, levenshtein, norm } from '../src/lib/text.js';
import { applyFreezes, applyPlacement, boxOf, streak, FREEZE_MAX, difficulty, grade, forecast, hardKeys, isDue, isStruggling, openCount, unitStats, weakSpots, INTERVALS, KNOWN_BOX } from '../src/lib/srs.js';
import { todayKey } from '../src/lib/text.js';
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

// ääntämisen arviointi
check('ääntäminen: artikkelilla', judgeSpoken(['il caffè'], caffe), 'ok');
check('ääntäminen: ilman artikkelia', judgeSpoken(['caffè'], caffe), 'ok');
check('ääntäminen: toinen vaihtoehto osuu', judgeSpoken(['cane', 'caffe'], caffe), 'ok');
check('ääntäminen: väärä sana', judgeSpoken(['cane'], caffe), 'no');
check('ääntäminen: lähes', judgeSpoken(['parlere'], CARDS.find(c=>c.it==='parlare')), 'near');

// ennuste
const fcState = defaultState();
const fcNow = Date.now();
const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
fcState.items.a = { b:1, due: fcNow - 3*86_400_000 };
fcState.items.b = { b:1, due: startOfDay.getTime() + 86_400_000 + 3_600_000 };
fcState.items.c = { b:1, due: startOfDay.getTime() + 20*86_400_000 };
const fc = forecast(fcState, 7);
check('ennuste: myöhässä lasketaan tälle päivälle', fc[0], 1);
check('ennuste: huomenna', fc[1], 1);
check('ennuste: kaukainen jää pois', fc.reduce((a,b)=>a+b,0), 2);

// putkisuoja
const dayAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return todayKey(d); };
const fz = defaultState();
fz.log[dayAgo(3)] = 5; fz.log[dayAgo(2)] = 5; fz.freezes = 1; // eilinen jäi väliin
check('putki ilman suojaa katkeaa', streak(fz), 0);
check('suoja peittää yhden päivän', applyFreezes(fz), true);
check('suojan jälkeen putki jatkuu (yhteensä 2 päivää)', streak(fz), 2);
check('suoja kului', fz.freezes, 0);
const fz2 = defaultState();
fz2.log[dayAgo(5)] = 5; fz2.freezes = 1; // kolme päivää väliin
check('liian pitkää katkoa ei peitetä', applyFreezes(fz2), false);
check('suoja säästyy silloin', fz2.freezes, 1);
const fz3 = defaultState();
fz3.log[dayAgo(4)] = 1; fz3.log[dayAgo(3)] = 1; fz3.freezes = 2; // 2 päivää väliin, 2 suojaa
check('kaksi suojaa peittää kahden päivän katkon', applyFreezes(fz3), true);
check('kahden päivän katko: putki jatkuu', streak(fz3), 2);
const fz4 = defaultState();
for (let i = 1; i <= 6; i++) fz4.log[dayAgo(i)] = 1; // 6 päivän putki, seitsemäs tänään
grade(fz4, 'ciao|hei, moi', true);
check('7. putkipäivä ansaitsee suojan', fz4.freezes, 1);
fz4.freezes = FREEZE_MAX; fz4.log = {}; for (let i = 1; i <= 6; i++) fz4.log[dayAgo(i)] = 1;
grade(fz4, 'ciao|hei, moi', true);
check('suojia ei kerry yli maksimin', fz4.freezes, FREEZE_MAX);

// tasotesti
const pl = defaultState();
pl.items[CURRICULUM[0].keys[0]] = { b: 1, due: 0, seen: 3, miss: 0, e: 1, h: '', lp: 0 };
const marked = applyPlacement(pl, [0, 1]);
check('tasotesti ei koske jo harjoiteltuun korttiin', pl.items[CURRICULUM[0].keys[0]].b, 1);
check('tasotesti merkitsee muut kortit', marked, CURRICULUM[0].keys.length + CURRICULUM[1].keys.length - 1);
check('tasotestin kortti on osattu', boxOf(pl, CURRICULUM[1].keys[0]), KNOWN_BOX);
check('tasotestin kortti erääntyy pian', pl.items[CURRICULUM[1].keys[0]].due - Date.now() <= 86_400_000, true);
check('tasotesti avaa seuraavan jakson', openCount(pl) >= 3, true);

// data integrity
check('kortit uniikkeja', new Set(CARDS.map(c=>c.key)).size, CARDS.length);
check('jokaisella kortilla jakso', CARDS.every(c=>c.units.length>0), true);
check('avaimet löytyvät', CURRICULUM.every(u=>u.keys.every(x=>BY_KEY.has(x))), true);

console.log(failed ? `\n${failed} testiä epäonnistui.` : "\nKaikki testit läpi.");
if (failed) process.exit(1);
