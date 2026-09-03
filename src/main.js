import "./styles.css";
import { app, el } from "./app.js";
import { dueKeys, streak } from "./lib/srs.js";
import { renderHome } from "./ui/home.js";
import { renderUnit } from "./ui/unit.js";
import { renderVerbs } from "./ui/verbs.js";
import { renderStats } from "./ui/stats.js";
import { initDrill } from "./ui/drill.js";
import { onVoicesArrive } from "./lib/speech.js";

const VIEWS = { home: "vHome", unit: "vUnit", verbs: "vVerbs", stats: "vStats" };

app.goto = (tab) => {
  app.tab = tab;
  document.querySelectorAll("nav.tabs button").forEach((b) => {
    b.setAttribute("aria-current", String(b.dataset.tab === (tab === "unit" ? "home" : tab)));
  });
  for (const [name, id] of Object.entries(VIEWS)) el(id).classList.toggle("on", name === tab);
  window.scrollTo(0, 0);
  app.render();
};

app.render = () => {
  el("cStreak").textContent = streak(app.state);
  el("cDue").textContent = dueKeys(app.state).length;
  if (app.tab === "home") renderHome();
  else if (app.tab === "unit") renderUnit();
  else if (app.tab === "verbs") renderVerbs();
  else if (app.tab === "stats") renderStats();
};

document.querySelectorAll("nav.tabs button").forEach((b) => {
  b.addEventListener("click", () => app.goto(b.dataset.tab));
});

initDrill();
app.goto("home");

// Selain voi ladata äänet vasta ensimmäisen renderin jälkeen. Kuuntelunapit
// piirretään vain jos italiankielinen ääni on olemassa, joten näkymä on
// piirrettävä uudelleen kun äänet saapuvat.
onVoicesArrive(() => app.render());

// file://-avauksessa (ks. README) service worker ei toimi eikä sitä tarvita.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
