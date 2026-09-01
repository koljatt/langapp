import "./styles.css";
import { app, el } from "./app.js";
import { dueKeys, streak } from "./lib/srs.js";
import { renderHome } from "./ui/home.js";
import { renderUnit } from "./ui/unit.js";
import { renderStats } from "./ui/stats.js";
import { initDrill } from "./ui/drill.js";

const VIEWS = { home: "vHome", unit: "vUnit", stats: "vStats" };

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
  else if (app.tab === "stats") renderStats();
};

document.querySelectorAll("nav.tabs button").forEach((b) => {
  b.addEventListener("click", () => app.goto(b.dataset.tab));
});

initDrill();
app.goto("home");
