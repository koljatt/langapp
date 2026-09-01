/** Edistymisen tallennus selaimen localStorageen + vienti/tuonti JSON-tiedostona. */

const LS_KEY = "parliamo.v1";

export const defaultState = () => ({
  v: 1,
  /** avain -> { b: laatikko, due: aikaleima, seen, miss, t } */
  items: {},
  /** "2026-09-01" -> vastausten määrä */
  log: {},
  best: 0,
  settings: { choice: 1, type: 1, listen: 1, recall: 1, goal: 25 },
  t: 0,
});

export function load() {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return {
      ...base,
      ...parsed,
      items: parsed.items || {},
      log: parsed.log || {},
      settings: { ...base.settings, ...(parsed.settings || {}) },
    };
  } catch (err) {
    console.warn("Tallennettua edistymistä ei voitu lukea:", err);
    return base;
  }
}

export function save(state) {
  state.t = Date.now();
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Tallennus epäonnistui:", err);
  }
}

export function reset() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch (err) {
    /* ei väliä */
  }
}

/** Yhdistää kaksi tilaa: korttikohtaisesti tuorein voittaa. */
export function merge(a, b) {
  if (!b) return a;
  const out = { ...defaultState(), ...a, items: { ...a.items }, log: { ...a.log } };
  for (const [k, y] of Object.entries(b.items || {})) {
    const x = out.items[k];
    if (!x || (y.t || 0) > (x.t || 0)) out.items[k] = y;
  }
  for (const [d, n] of Object.entries(b.log || {})) {
    out.log[d] = Math.max(out.log[d] || 0, n);
  }
  out.best = Math.max(a.best || 0, b.best || 0);
  if ((b.t || 0) > (a.t || 0)) out.settings = { ...a.settings, ...b.settings };
  out.t = Math.max(a.t || 0, b.t || 0);
  return out;
}

/** Lataa edistyminen tiedostona — varmuuskopio tai siirto toiselle koneelle. */
export function exportFile(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `parliamo-edistyminen-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lukee viedyn tiedoston ja yhdistää sen nykyiseen tilaan. */
export function importFile(current) {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return reject(new Error("Tiedostoa ei valittu"));
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const incoming = JSON.parse(String(reader.result));
          if (!incoming || typeof incoming !== "object" || !incoming.items) {
            throw new Error("Tiedosto ei ole Parliamo-varmuuskopio");
          }
          resolve(merge(current, incoming));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}
