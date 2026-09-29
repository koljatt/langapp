/**
 * Pieni API-välipalvelin Gemini-kutsuille. Avain pysyy täällä (Worker-salaisuus
 * GEMINI_API_KEY), selain ei näe sitä. Kehotteet ovat palvelimella lukittuina,
 * jotta tätä ei voi käyttää yleiskäyttöisenä LLM-välityksenä.
 *
 *   POST /api/explain   { it, fi, answer, dir }        -> { text }
 *   POST /api/roleplay  { scenario, messages: [...] }  -> { reply, fi, fix }
 *
 * Suojaus: APP_TOKEN-salaisuus (jos asetettu) vaaditaan x-app-token-otsakkeessa,
 * ja LIMITER-sidos rajoittaa kutsutahtia. Päiväkatto tulee Googlen puolelta
 * (kiintiö / laskutusraja), koska Workerilla ei ole pysyvää laskuria ilman
 * KV/D1-sidosta.
 */

const MAX_TEXT = 300;
const MAX_TURNS = 20;

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

const roleplaySystem = (scene) => `${scene}
Opiskelija on suomalainen italian alkeiskurssilaisen (CEFR A1). Puhu yksinkertaista italiaa:
lyhyet lauseet, perussanasto, nykyhetki. Pidä keskustelu käynnissä kysymällä yksi asia kerrallaan.
Vastaa AINA JSON-oliolla: {"reply": "vastauksesi italiaksi (1-2 lyhyttä lausetta)",
"fi": "suomennos vastauksestasi", "fix": "jos opiskelijan viimeisessä viestissä oli virhe, selitä se
suomeksi yhdellä lauseella ja anna oikea muoto; muuten tyhjä merkkijono"}.`;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const clean = (v) => String(v ?? "").slice(0, MAX_TEXT);

async function gemini(env, system, contents, { json: asJson = false, maxTokens = 400 } = {}) {
  const model = env.GEMINI_MODEL || "gemini-flash-latest";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
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
  const text = await gemini(env, EXPLAIN_SYSTEM, [{ role: "user", parts: [{ text: prompt }] }], { maxTokens: 300 });
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
  const raw = await gemini(env, roleplaySystem(scene), contents, { json: true, maxTokens: 500 });
  try {
    const o = JSON.parse(raw);
    return { reply: clean(o.reply), fi: clean(o.fi), fix: clean(o.fix) };
  } catch {
    return { reply: raw.slice(0, MAX_TEXT), fi: "", fix: "" };
  }
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
      return json({ error: "not_found" }, 404);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "upstream" }, 502);
    }
  },
};
