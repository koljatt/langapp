# Parliamo

Finnish → Italian practice app, CEFR level A1. 24 units, 671 vocabulary cards, 162 verb-conjugation cards, 72 sentence exercises, and spaced repetition that adapts to what you keep getting wrong — installable as an offline app.

Everything is in Finnish on screen; the code and this README are in English.

## Running it

```powershell
cd parliamo
npm install
npm run dev
```

Vite serves it at <http://localhost:5173> and opens a browser. `npm run build` produces a static bundle in `dist/` that you can open from disk or drop on any web host — no backend involved.

`npm run check` validates the vocabulary data (missing fields, duplicate words inside a unit, malformed rows) — run it after editing content. `npm test` runs dependency-free unit tests over the answer-checking, mistake-classification and scheduling logic.

## Project layout

```
src/
  main.js               view switching, header counters, wiring, service-worker registration
  app.js                shared mutable app state
  styles.css            design tokens + all component styles
  data/
    index.js            builds CARDS + STAGES from the stage files
    stage-1-…4-….js     the curriculum itself, each unit optionally carrying `ex` (cloze sentences)
    verbs.js            verb-conjugation card set, independent of the vocabulary curriculum
  lib/
    srs.js              adaptive scheduler, difficulty scoring, unit stats, unlocking
    store.js            localStorage, export/import, merge
    text.js             normalisation, accepted-answer logic, mistake classification, gender derivation
    speech.js           Italian speech synthesis, voice selection
  ui/
    home.js unit.js verbs.js stats.js drill.js icons.js
public/
  manifest.webmanifest  PWA metadata
  sw.js                 offline service worker
scripts/check-data.js   data validation
```

## How the scheduler works

Each card sits in a box `0…7`. Correct → up one box, wrong → down two (not to zero; a full reset is punishing in a 671-card deck). The box picks the next interval in days:

| box | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| days | now | 1 | 2 | 4 | 8 | 16 | 32 | 64 |

A card counts as *osattu* (known) from box 3. A unit unlocks the next one once 60 % of its cards are known — that keeps the whole 671-word deck from landing at once. Both thresholds are constants at the top of `src/lib/srs.js`.

On top of the box, each card carries an **ease factor** `e` between 0.4 and 1 that multiplies the interval. A wrong answer knocks it down by 0.15, a right one nudges it back up by 0.05. It never rises above 1, so a card you have never missed behaves exactly as the table says — only cards you keep tripping over come back sooner than their box would suggest. Two cards can share box 3 and be due 4 days and 2 days from now.

Drill mode is chosen per card from its box: box 0–1 gets multiple choice (recognition), 2–3 typing (active recall), 4+ a self-rated flashcard, with dictation interleaved at ~22 % *once a card has reached box 2* — hearing a word and spelling it needs the recall that typing already builds, so it's never sprung on a word you haven't typed yet. Unseen cards get an introduction screen first, which always resolves to recognition or typing next, never dictation or the flashcard. A card answered wrong comes back once more at the end of the same session. A card flagged as a *kompastuskivi* never gets the self-rated flashcard — self-assessment is exactly where a word you don't really know hides.

## What it learns about you

Every answer records the drill mode, the direction asked, and — for typed answers — what kind of mistake it was. Out of that the app builds a per-card **difficulty score** (0…1) from four signals, weighted in `difficulty()`:

| signal | weight | what it catches |
|---|---|---|
| miss rate over the last 12 answers | 0.50 | what you are struggling with *now* |
| lifetime miss rate | 0.20 | words that were never easy |
| lapses — falls back out of *osattu* | 0.15 | words that look learned and aren't |
| ease factor | 0.15 | the scheduler's own verdict |

Past `STRUGGLE` (0.25 — roughly one wrong in three recent answers) the card becomes a *kompastuskivi*, and three things happen:

- **A quarter of every session** is reserved for stumbling blocks, whether or not they are due. Toggleable under Tilastot → *Painota kompastuskiviä*.
- The card is **tagged in the drill** and shows its disambiguation note in both directions, not just Finnish → Italian.
- The home screen and the unit page offer a **drill of only those words**.

Typed mistakes are classified in `classifyMiss()` and counted, so Tilastot → *Missä kompastelet* can tell you the shape of your errors rather than just the count: `tupla` (a missed double consonant — `piza` for `pizza`), `paate` (wrong ending, so gender or number — `ragazza` for `ragazzo`), `artikkeli`, `kirjoitus` (edit distance ≤ 2), `sekaannus` (mixed up with a different word), `eisana`. The same panel breaks accuracy down by drill mode and by direction, which is what tells you whether recognition is fine and production is not, and lists the units where the stumbling blocks cluster.

## Sentence practice (cloze)

Word ↔ word drilling never touches how the grammar notes actually get used in a sentence. Units carry an optional `ex` array — `["Vorrei un ___, per favore.", "caffè"]` — of fill-in-the-blank sentences built only from vocabulary the unit (or an earlier one) has already taught, so nothing in the scaffolding is unfamiliar. Unit page → *Harjoittele lauseita* runs them as a short quiz. It isn't SRS-scheduled: a sentence isn't a single recallable fact the way a card or a verb form is, so this is a repeatable drop-in exercise rather than something with its own box and due date. All 24 units have three sentences each (72 total), hand-checked against the curriculum's own grammar notes.

## Verb conjugation

The vocabulary curriculum teaches conjugated forms piecemeal — `faccio` appears, `fate` doesn't. `src/data/verbs.js` fills in the full six-person present tense for 23 verbs (regular `-are`/`-ere`/`-ire`, the `-isc-` group, five reflexives, and eight irregulars: `essere, avere, andare, venire, fare, potere, volere, dovere`) plus a limited passato prossimo set. Each form is its own card with a key like `lavorare|noi`. Verbs already fully conjugated as vocabulary — `parlare` itself, the app's namesake — are deliberately left out of this set, so it only ever teaches a form the curriculum hasn't already covered. These cards run through the exact same `grade()`/box/ease/due machinery as vocabulary, just in their own key namespace, reachable from the new **Verbit** tab — pick one verb or a mixed session across all of them.

Passato prossimo is scoped to *avere*-auxiliary verbs only. *Essere*-verbs agree with the subject's gender (*sono andato* / *sono andata*), which a person-only conjugation drill has no way to get right without guessing — so rather than teach a coin-flip, those stay as the fixed first-person vocabulary cards the curriculum already has and aren't included here.

## Gender (il/la)

Nouns in this curriculum already carry their gender in their own Italian form — `il caffè`, `la casa` — so `genderOf()` in `src/lib/text.js` reads it off the existing article instead of hand-tagging 671 cards (which would also risk getting the genuine exceptions wrong, like `il problema` or `la mano`, both called out in the curriculum's own notes and both handled correctly *because* nothing is guessed from the noun's ending). Only singular articles count (`il/lo/un/uno` → masculine, `la/una` → feminine); plural-only nouns and elided `l'` are left out — elision hides the gender (`l'amico` vs `l'amica`) and can't be recovered without a dictionary. Idioms and multi-word quantity phrases (`un po'`, `un chilo di`) are filtered out too, so the drill only ever asks about an actual noun. Unit page → *Il vai la?* when a unit has at least three eligible nouns; graded via the same SRS under a `word|gender` key, kept separate from the word's own vocabulary progress since spelling and gender are different things to know.

## Installing as an app (PWA)

`public/manifest.webmanifest` and `public/sw.js` make the built app installable and usable offline. The service worker is network-first with a same-origin runtime cache: every successful response gets cached as you browse, so a repeat visit — including offline — is served from cache without needing to know the build's hashed filenames in advance. A new deploy just works, since Vite's content-hashed asset names never collide with the previous version's cache entries. It only registers over `http(s)`, so opening `dist/index.html` straight off disk (see *Running it* above) is unaffected.

## Vocabulary format

Each unit is an object; each word is `[italian, finnish, note?]`:

```js
{
  id: "u7",
  stage: "A1.2 · Arki",
  title: "Säännölliset -are-verbit",
  it: "I verbi in -are",
  grammar: `<p>…</p>`,          // HTML, shown on the unit page
  items: [
    ["parlare", "puhua"],
    ["scusi", "anteeksi", "teititellen"],
  ],
  ex: [                          // valinnainen: aukkolauseita, ks. "Sentence practice" yllä
    ["Noi ___ italiano.", "parliamo"],
  ],
}
```

The note disambiguates when the same Finnish word maps to several Italian ones, and it shows up as a hint in the Finnish → Italian direction. `ex` is optional and, when present, every sentence must contain `___` and use only vocabulary the curriculum has already introduced by that unit — `npm run check` enforces the former, not the latter.

To add a unit: append it to the relevant `src/data/stage-*.js` file (or make a new file and import it in `src/data/index.js`), then run `npm run check`. The same `[italian, finnish]` pair appearing in two units is fine — it stays one card that belongs to both.

## Answer checking

Typed answers are compared after stripping accents, case, punctuation and a leading article, so `caffe` is accepted for `il caffè`. Where one Finnish prompt has several valid Italian answers (`anteeksi` → `scusa` / `scusi`), any of them is accepted. Finnish answers accept any comma-separated alternative from the translation.

Two things soften the verdict without letting anything slide:

- **Accents are accepted but coached.** `caffe` counts as right, and the feedback line then shows `Aksentit: caffè`. Nothing is penalised; you just see the spelling.
- **A one-letter slip in a word of five or more letters** (`parlere` for `parlare`) is graded *melkein*: the box does not drop, the ease factor takes half the usual hit, and the card returns later in the session. A typo is not a forgotten word, and counting it as one would poison the very statistics that decide what you practise. Gemination is deliberately excluded — `piza` for `pizza` is a real spelling fact, not a slip, and is scored wrong.

## Storage

Progress lives in `localStorage` under `parliamo.v1` — per browser, no account, no server. Each card record is `{ b: box, due, seen, miss, t, e: ease, h: last 12 results as a string of 1s and 0s, lp: lapses }`; the mistake and accuracy tallies live alongside under `stats`. Records written before the adaptive scheduler are filled in on first use, so an old backup imports fine.

Settings → *Vie tiedostoon* writes a JSON backup; *Tuo tiedostosta* merges one back in, taking the newer record per card and the larger of each counter (larger, not the sum — two machines that share a history would otherwise double-count). That is also how you move progress between machines.

## Speech

Uses the browser's `speechSynthesis` with an `it-IT` voice. Chrome and Edge on Windows ship one; if dictation is greyed out, install an Italian voice under Settings → Time & language → Speech. There is no audio file to download and nothing to pay for.

The voice is picked automatically by default, but Tilastot → *Ääni* lets you pin a specific one and stores the choice by name in `settings.voiceName`. That's a deliberate fix, not just a nicety: with no pinned choice, the app re-picks from whatever `speechSynthesis.getVoices()` returns, and that list's order isn't stable — an OS update, browser update, or just a slow first load can silently reorder it and swap which voice gets picked, including switching gender or pronunciation quality out from under you with no visible cause. Once pinned, the choice is matched by voice name regardless of list order, so it survives exactly that kind of reshuffle.

## Notes on the content

Vocabulary and grammar notes were written for this project, targeting A1: greetings and courtesy through to `passato prossimo` and planning. Grammar notes are deliberately short — they explain the pattern, name the exception, and stop.
