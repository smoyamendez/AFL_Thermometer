import { getState, subscribe } from "./store.js";
import { normalize, progress, money } from "./progress.js";

const BODY_HEIGHT = 490; // tube body spans y=110..600 in the SVG

const el = {
  tube: document.getElementById("tube"),
  cover: document.getElementById("tube-cover"),
  tubePct: document.getElementById("tube-pct"),
  raised: document.getElementById("raised"),
  goal: document.getElementById("goal"),
};

function render(state) {
  const s = normalize(state);
  const p = progress(s);
  const pct = Math.round(p * 100);

  // Slide the "empty" cover up to reveal the paint (animated in CSS).
  el.cover.style.transform = "translateY(" + (-BODY_HEIGHT * p).toFixed(1) + "px)";

  el.tubePct.textContent = pct + "%";
  el.raised.textContent = money(s.raised);
  el.goal.textContent = money(s.goal);

  el.tube.setAttribute("aria-valuenow", String(pct));
  el.tube.setAttribute("aria-valuetext", pct + "% — " + money(s.raised) + " of " + money(s.goal) + " raised");
}

render({ raised: 0, goal: 1 });
getState().then((s) => {
  // Let the empty tube paint once so the first fill animates.
  requestAnimationFrame(() => requestAnimationFrame(() => render(s)));
});
subscribe(render);
