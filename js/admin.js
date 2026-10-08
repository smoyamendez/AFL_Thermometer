import { MODE, AUTH_REQUIRED, auth, getState, setState, subscribe } from "./store.js";
import { normalize, progress, money } from "./progress.js";

const $ = (id) => document.getElementById(id);
const el = {
  signin: $("signin"), email: $("email"), password: $("password"),
  signinError: $("signin-error"), signinBtn: $("signin-btn"),
  controls: $("controls"),
  pRaised: $("p-raised"), pGoal: $("p-goal"), pBar: $("p-bar"), pPct: $("p-pct"), pStatus: $("p-status"),
  raised: $("raised"), goal: $("goal"),
  saveNote: $("save-note"), reset: $("reset"),
  sync: $("sync"), syncLabel: $("sync-label"), syncHelp: $("sync-help"), signout: $("signout"),
};

let state = normalize(await getState());

// --------------------------------------------------------------- rendering
function setInput(input, value) {
  // Don't fight the user while they're typing in a field.
  if (document.activeElement !== input) input.value = String(value);
}

function render() {
  const p = progress(state);
  el.pRaised.textContent = money(state.raised);
  el.pGoal.textContent = money(state.goal);
  el.pBar.style.width = (p * 100).toFixed(1) + "%";
  el.pPct.textContent = String(Math.round(p * 100));
  el.pStatus.textContent = state.raised >= state.goal ? "🎉 Goal reached!" : "In progress";
  setInput(el.raised, state.raised);
  setInput(el.goal, state.goal);
}

function renderSync() {
  el.sync.classList.remove("is-live", "is-warn");
  el.signout.hidden = true;
  if (MODE === "local") {
    el.syncLabel.textContent = "● Local only — this browser";
    el.syncHelp.textContent = "To sync across devices, add your Firebase details in js/config.js — see README.md.";
    return;
  }
  if (!AUTH_REQUIRED) {
    el.sync.classList.add("is-warn");
    el.syncLabel.textContent = "● Live — not secured";
    el.syncHelp.textContent = "Add FIREBASE_API_KEY in js/config.js and lock the database rules so only staff can save.";
    return;
  }
  el.sync.classList.add("is-live");
  el.syncLabel.textContent = "● Live — synced across all devices";
  const user = auth.user();
  el.syncHelp.textContent = user ? "Signed in as " + user.email + ". Every visitor sees changes instantly." : "Every visitor sees changes instantly.";
  el.signout.hidden = !user;
}

function showView() {
  const needSignIn = AUTH_REQUIRED && !auth.user();
  el.signin.hidden = !needSignIn;
  el.controls.hidden = needSignIn;
  renderSync();
  if (needSignIn) el.email.focus();
}

// ------------------------------------------------------------------ saving
// Saves run one at a time; if several edits land while one is in flight,
// only the latest state is sent next.
let saving = false;
let dirty = false;

function note(text, isError) {
  el.saveNote.textContent = text;
  el.saveNote.classList.toggle("is-error", !!isError);
}

async function flush() {
  if (saving) return;
  saving = true;
  while (dirty) {
    dirty = false;
    note("Saving…");
    try {
      await setState(state);
      if (!dirty) note("Saved automatically");
    } catch (e) {
      dirty = false;
      note(e.message || "Couldn't save. Check your connection.", true);
      if (AUTH_REQUIRED && !(await auth.getIdToken())) showView();
    }
  }
  saving = false;
}

function update(patch) {
  state = normalize({ ...state, ...patch });
  render();
  dirty = true;
  flush();
}

// ------------------------------------------------------------------ events
el.raised.addEventListener("change", () => update({ raised: el.raised.value }));
el.goal.addEventListener("change", () => update({ goal: el.goal.value }));
for (const input of [el.raised, el.goal]) {
  input.addEventListener("blur", () => render()); // show the clamped value
}

document.querySelectorAll("[data-delta]").forEach((btn) => {
  btn.addEventListener("click", () => update({ raised: state.raised + Number(btn.dataset.delta) }));
});

el.reset.addEventListener("click", () => {
  if (confirm("Reset the amount raised to $0? The public page will show an empty tube.")) {
    update({ raised: 0 });
  }
});

el.signin.addEventListener("submit", async (e) => {
  e.preventDefault();
  el.signinError.textContent = "";
  el.signinBtn.disabled = true;
  try {
    await auth.signIn(el.email.value.trim(), el.password.value);
    el.password.value = "";
    state = normalize(await getState());
    render();
    showView();
  } catch (err) {
    el.signinError.textContent = err.message;
  } finally {
    el.signinBtn.disabled = false;
  }
});

el.signout.addEventListener("click", () => {
  auth.signOut();
  showView();
});

// Keep in step with changes made from other devices / tabs.
subscribe((s) => {
  if (saving || dirty) return;
  state = normalize(s);
  render();
});

render();
showView();
