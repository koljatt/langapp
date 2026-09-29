/**
 * Pieni API-välipalvelin Gemini-kutsuille. Avain pysyy täällä (Worker-salaisuus
 * GEMINI_API_KEY), selain ei näe sitä. Kehotteet ovat palvelimella lukittuina,
 * jotta tätä ei voi käyttää yleiskäyttöisenä LLM-välityksenä.
 *
 *   POST /api/explain   { it, fi, answer, dir }        -> { text }
 *   POST /api/roleplay  { scenario, messages: [...], words?: [...] } -> { reply, fi, fix }
 *   POST /api/patterns  { fixes: [{ m, f }] }          -> { text }
 *
 * Suojaus: APP_TOKEN-salaisuus (jos asetettu) vaaditaan x-app-token-otsakkeessa,
 * ja LIMITER-sidos rajoittaa kutsutahtia. Päiväkatto tulee Googlen puolelta
 * (kiintiö / laskutusraja), koska Workerilla ei ole pysyvää laskuria ilman
 * KV/D1-sidosta.
 */

const MAX_TEXT = 300;
const MAX_TURNS = 20;
const MAX_WORDS = 12;
const MAX_FIXES = 30;

const SCENARIOS = {
  caffe: "Olet barista italialaisessa kahvilassa. Asiakas (opiskelija) tilaa juotavaa ja syötävää.",
  negozio: "Olet myyjä vaatekaupassa. Asiakas (opiskelija) kysyy kokoja, värejä ja hintoja.",
  presentazione: "Olet uusi tuttavuus juhlissa. Tutustutte: nimet, kotimaa, työ tai opinnot, harrastukset.",
  ristorante: "Olet tarjoilija ravintolassa. Asiakas (opiskelija) tilaa ruokaa ja pyytää laskun.",
  indicazioni: "Olet kadulla kohdattu paikallinen. Turisti (opiskelija) kysyy tietä.",
};

const EXPLAIN_SYSTEM = `Olet ystävällinen italian opettaja suomenkieliselle A1-tason opiskelijalle.
Opiskelija vastasi väärin sanaharjoituksessa. Selitä suomeksi enintään 3 lyhyellä lauseella,
miksi oikea vastaus on se mikä on ja mikä vastauksessa meni pieleen. Jos sopii, anna yksi
muistisääntö tai lyhyt esimerkkilause italiaksi suomennoksineen. Ei otsikoita, ei listoja.`;

const PATTERNS_SYSTEM = `Olet italian opettaja. Saat listan suomalaisen A1-tason opiskelijan viesteistä, joissa oli virhe,
sekä korjauksista. Tunnista 2–3 toistuvaa virhemallia (esim. artikkelit, verbin taivutus, sanajärjestys, sanavalinta).
Selitä jokainen suomeksi yhdellä lauseella ja anna yksi esimerkki italiaksi. Jos virheet eivät toistu, sano se ja
kehu. Älä käytä otsikoita. Vastaa enintään 120 sanalla.`;

const roleplaySystem = (scene, words) => `${scene}${
  words.length
    ? `\nOpiskelija on äskettäin opetellut nämä sanat: ${words.join(", ")}. Käytä niitä luontevasti keskustelussa kun ne sopivat, mutta älä pakota.`
    : ""
}
Opiskelija on suomalainen italian alkeiskurssilaisen (CEFR A1). Puhu yksinkertaista italiaa:
lyhyet lauseet, perussanasto, nykyhetki. Pidä keskustelu käynnissä kysymällä yksi asia kerrallaan.
Vastaa AINA JSON-oliolla: {"reply": "vastauksesi italiaksi (1-2 lyhyttä lausetta)",
"fi": "suomennos vastauksestasi", "fix": "jos opiskelijan viimeisessä viestissä oli virhe, selitä se
suomeksi yhdellä lauseella ja anna oikea muoto; muuten tyhjä merkkijono"}.`;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const clean = (v) => String(v ?? "").slice(0, MAX_TEXT);

async function gemini(env, system, contents, { json: asJson = false, maxTokens = 1024 } = {}) {
  const model = env.GEMINI_MODEL || "gemini-3.8-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
        // maxOutputTokens rajaa myös ajattelutokenit: matala taso pitää vastauksen mahtumassa rajaan.
        thinkingConfig: { thinkingLevel: "low" },
        ...(asJson ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
}

async function explain(env, b) {
  const dir = b.dir === "it2fi" ? "italiasta suomeen" : "suomesta italiaan";
  const prompt = `Suunta: ${dir}\nItaliaksi: ${clean(b.it)}\nSuomeksi: ${clean(b.fi)}\nOpiskelijan vastaus: ${clean(b.answer) || "(tyhjä)"}`;
  const text = await gemini(env, EXPLAIN_SYSTEM, [{ role: "user", parts: [{ text: prompt }] }], { maxTokens: 1024 });
  return { text };
}

async function roleplay(env, b) {
  const scene = SCENARIOS[b.scenario];
  if (!scene) throw new HttpError(400, "unknown scenario");
  const msgs = Array.isArray(b.messages) ? b.messages.slice(-MAX_TURNS) : [];
  const contents = msgs.map((m) => ({
    role: m.role === "model" ? "model" : "user",
    parts: [{ text: clean(m.text) }],
  }));
  // Gemini vaatii että keskustelu alkaa käyttäjän vuorolla.
  if (!contents.length || contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "(aloita keskustelu tervehtimällä)" }] });
  }
  const words = (Array.isArray(b.words) ? b.words : []).slice(0, MAX_WORDS).map((w) => clean(w).slice(0, 40)).filter(Boolean);
  const raw = await gemini(env, roleplaySystem(scene, words), contents, { json: true, maxTokens: 1024 });
  try {
    const o = JSON.parse(raw);
    return { reply: clean(o.reply), fi: clean(o.fi), fix: clean(o.fix) };
  } catch {
    return { reply: raw.slice(0, MAX_TEXT), fi: "", fix: "" };
  }
}

async function patterns(env, b) {
  const fixes = (Array.isArray(b.fixes) ? b.fixes : []).slice(-MAX_FIXES);
  if (fixes.length < 3) throw new HttpError(400, "too few");
  const prompt = fixes.map((x, i) => `${i + 1}. Viesti: ${clean(x.m)}\n   Korjaus: ${clean(x.f)}`).join("\n");
  const text = await gemini(env, PATTERNS_SYSTEM, [{ role: "user", parts: [{ text: prompt }] }], { maxTokens: 1024 });
  return { text };
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (request.method !== "POST") return json({ error: "method" }, 405);

    if (env.APP_TOKEN && request.headers.get("x-app-token") !== env.APP_TOKEN) {
      return json({ error: "unauthorized" }, 401);
    }
    if (!env.GEMINI_API_KEY) return json({ error: "not_configured" }, 503);
    if (env.LIMITER) {
      const { success } = await env.LIMITER.limit({ key: request.headers.get("cf-connecting-ip") || "anon" });
      if (!success) return json({ error: "rate_limited" }, 429);
    }

    try {
      const body = await request.json();
      if (pathname === "/api/explain") return json(await explain(env, body));
      if (pathname === "/api/roleplay") return json(await roleplay(env, body));
      if (pathname === "/api/patterns") return json(await patterns(env, body));
      return json({ error: "not_found" }, 404);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "upstream" }, 502);
    }
  },
};
