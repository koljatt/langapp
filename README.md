# Parliamo

Finnish → Italian practice app, CEFR level A1. 24 units, 681 unique cards, spaced repetition, four drill modes.

Everything is in Finnish on screen; the code and this README are in English.

## Running it

```powershell
cd parliamo
npm install
npm run dev
```

Vite serves it at <http://localhost:5173> and opens a browser. `npm run build` produces a static bundle in `dist/` that you can open from disk or drop on any web host — no backend involved.

`npm run check` validates the vocabulary data (missing fields, duplicate words inside a unit, malformed rows) — run it after editing content. `npm test` runs dependency-free unit tests over the answer-checking and scheduling logic.

## Project layout

```
src/
  main.js               view switching, header counters, wiring
  app.js                shared mutable app state
  styles.css            design tokens + all component styles
  data/
    index.js            builds CARDS + STAGES from the stage files
    stage-1-…4-….js     the curriculum itself
  lib/
    srs.js              Leitner scheduler, unit stats, unlocking
    store.js            localStorage, export/import, merge
    text.js             normalisation, accepted-answer logic
    speech.js           Italian speech synthesis
  ui/
    home.js unit.js stats.js drill.js icons.js
scripts/check-data.js   data validation
```

## How the scheduler works

Each card sits in a box `0…7`. Correct → up one box, wrong → down two (not to zero; a full reset is punishing in a 681-card deck). The box picks the next interval in days:

| box | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| days | now | 1 | 2 | 4 | 8 | 16 | 32 | 64 |

A card counts as *osattu* (known) from box 3. A unit unlocks the next one once 60 % of its cards are known — that keeps the whole 681-word deck from landing at once. Both thresholds are constants at the top of `src/lib/srs.js`.

Drill mode is chosen per card from its box: box 0–1 gets multiple choice (recognition), 2–3 typing (active recall), 4+ a self-rated flashcard, with listening interleaved at ~22 %. Unseen cards get an introduction screen first. A card answered wrong comes back once more at the end of the same session.

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
}
```

The note disambiguates when the same Finnish word maps to several Italian ones, and it shows up as a hint in the Finnish → Italian direction.

To add a unit: append it to the relevant `src/data/stage-*.js` file (or make a new file and import it in `src/data/index.js`), then run `npm run check`. The same `[italian, finnish]` pair appearing in two units is fine — it stays one card that belongs to both.

## Answer checking

Typed answers are compared after stripping accents, case, punctuation and a leading article, so `caffe` is accepted for `il caffè`. Where one Finnish prompt has several valid Italian answers (`anteeksi` → `scusa` / `scusi`), any of them is accepted. Finnish answers accept any comma-separated alternative from the translation.

## Storage

Progress lives in `localStorage` under `parliamo.v1` — per browser, no account, no server. Settings → *Vie tiedostoon* writes a JSON backup; *Tuo tiedostosta* merges one back in, taking the newer record per card. That is also how you move progress between machines.

## Speech

Uses the browser's `speechSynthesis` with an `it-IT` voice. Chrome and Edge on Windows ship one; if the listening mode is greyed out, install an Italian voice under Settings → Time & language → Speech. There is no audio file to download and nothing to pay for.

## Notes on the content

Vocabulary and grammar notes were written for this project, targeting A1: greetings and courtesy through to `passato prossimo` and planning. Grammar notes are deliberately short — they explain the pattern, name the exception, and stop.
