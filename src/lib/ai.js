/** Kutsut Workerin /api/*-reitteihin (Gemini). Vaatii verkon; muu sovellus toimii offline. */

import { app } from "../app.js";

const MESSAGES = {
  offline: "Tämä ominaisuus vaatii verkkoyhteyden.",
  unauthorized: "Väärä tai puuttuva pääsykoodi — aseta se Tilastot-välilehdellä.",
  not_configured: "Palvelimelle ei ole asetettu Gemini-avainta.",
  rate_limited: "Liian tiheästi — odota hetki.",
  timeout: "Vastaus viipyi liian kauan. Yritä uudelleen.",
};

export async function ai(path, body) {
  if (!navigator.onLine) throw new Error(MESSAGES.offline);
  let res;
  // Ilman aikarajaa jumittunut pyyntö jättäisi keskustelun odottamaan ikuisesti.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    res = await fetch(`/api/${path}`, {
      signal: ctl.signal,
      method: "POST",
      headers: { "content-type": "application/json", "x-app-token": app.state.settings.aiToken || "" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(err.name === "AbortError" ? MESSAGES.timeout : MESSAGES.offline);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(MESSAGES[error] || "Tekoälypalvelu ei vastannut. Yritä hetken päästä uudelleen.");
  }
  return res.json();
}

export const SCENARIOS = [
  ["caffe", "Kahvilassa", "Tilaa kahvi ja jotain syötävää"],
  ["ristorante", "Ravintolassa", "Tilaa ruokaa ja pyydä lasku"],
  ["negozio", "Vaatekaupassa", "Kysy kokoja, värejä ja hintoja"],
  ["presentazione", "Tutustuminen", "Kerro itsestäsi ja kysy toisesta"],
  ["indicazioni", "Tien kysyminen", "Kysy kadulla reittiä"],
];
