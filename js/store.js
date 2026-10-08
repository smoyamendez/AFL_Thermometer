// ============================================================================
//  Paint Fund data store.
//
//  Both pages depend only on this interface:
//    getState()        → Promise<{ raised, goal }>   (never rejects)
//    setState(state)   → Promise<state>          (rejects if the save failed)
//    subscribe(cb)     → unsubscribe fn;  cb(state) on every change
//    auth.*            → staff sign-in for the admin page (live mode only)
//
//  Modes (see js/config.js):
//    • local    — no database URL: localStorage, synced across tabs of one browser.
//    • firebase — Firebase Realtime Database over REST. Reads are public;
//                 writes carry a Firebase Auth ID token, and the database
//                 rules (database.rules.json) only accept signed-in staff.
// ============================================================================

import { FIREBASE_DB_URL, FIREBASE_API_KEY, DEFAULTS } from "./config.js";
import { normalize } from "./progress.js";

export const MODE = FIREBASE_DB_URL ? "firebase" : "local";
export const AUTH_REQUIRED = MODE === "firebase" && !!FIREBASE_API_KEY;

const KEY = "paintFundState";
const AUTH_KEY = "paintFundAuth";
const base = FIREBASE_DB_URL.replace(/\/$/, "");
const RECORD_URL = base + "/paintFund.json";

// ---------------------------------------------------------------- local cache
function readLocal() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === "object") return normalize(s);
  } catch (e) {}
  return null;
}
function writeLocal(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
}

// ------------------------------------------------------------------- remote
async function getRemote() {
  const r = await fetch(RECORD_URL, { cache: "no-store" });
  if (!r.ok) throw new Error("GET " + r.status);
  return await r.json(); // null when the database is empty
}

async function putRemote(s) {
  let url = RECORD_URL;
  if (AUTH_REQUIRED) {
    const token = await auth.getIdToken();
    if (!token) throw new Error("Please sign in again.");
    url += "?auth=" + encodeURIComponent(token);
  }
  const r = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  });
  if (r.status === 401) throw new Error("Not allowed to save. Sign in again, or ask for this account to be added as an admin.");
  if (!r.ok) throw new Error("Save failed (" + r.status + ").");
  return await r.json();
}

// ----------------------------------------------------------------- public API
export async function getState() {
  if (MODE === "firebase") {
    try {
      const s = await getRemote();
      if (s && typeof s === "object") {
        const clean = normalize(s);
        writeLocal(clean);
        return clean;
      }
      return { ...DEFAULTS }; // empty database; the first admin save creates it
    } catch (e) {
      return readLocal() || { ...DEFAULTS };
    }
  }
  return readLocal() || { ...DEFAULTS };
}

export async function setState(s) {
  const clean = normalize(s);
  if (MODE === "firebase") await putRemote(clean);
  writeLocal(clean);
  return clean;
}

export function subscribe(cb) {
  if (MODE === "firebase") return subscribeRemote(cb);

  // LOCAL mode: the storage event fires in *other* tabs of this browser.
  const onStorage = (e) => {
    if (e.key === KEY) { const s = readLocal(); if (s) cb(s); }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

// Firebase REST streaming: https://firebase.google.com/docs/reference/rest/database#section-streaming
function subscribeRemote(cb) {
  let current = null;
  let es = null;
  let closed = false;

  const emit = () => {
    if (current && typeof current === "object") {
      const clean = normalize(current);
      writeLocal(clean);
      cb(clean);
    }
  };
  const pull = () => getRemote().then((s) => { current = s; emit(); }).catch(() => {});

  const apply = (kind) => (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    if (!msg || typeof msg.path !== "string") return;
    if (msg.path === "/") {
      current = kind === "put" ? msg.data : { ...(current || {}), ...(msg.data || {}) };
    } else {
      const parts = msg.path.split("/").filter(Boolean);
      if (parts.length > 1) { pull(); return; } // deeper paths: just re-read
      current = { ...(current || {}), [parts[0]]: msg.data };
    }
    emit();
  };

  try {
    es = new EventSource(RECORD_URL);
    es.addEventListener("put", apply("put"));
    es.addEventListener("patch", apply("patch"));
  } catch (e) {}

  // Backup in case the stream drops (EventSource also reconnects on its own).
  const poll = setInterval(() => { if (!closed && (!es || es.readyState !== 1)) pull(); }, 8000);
  const onVisible = () => { if (document.visibilityState === "visible") pull(); };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    closed = true;
    if (es) es.close();
    clearInterval(poll);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

// ---------------------------------------------------------------------- auth
// Firebase Auth (email/password) via its REST API, so no SDK is needed.
// Staff accounts are created in the Firebase console → Authentication → Users.

const AUTH_ERRORS = {
  INVALID_LOGIN_CREDENTIALS: "That email and password don't match.",
  EMAIL_NOT_FOUND: "That email and password don't match.",
  INVALID_PASSWORD: "That email and password don't match.",
  INVALID_EMAIL: "Please enter a valid email address.",
  USER_DISABLED: "This account has been disabled.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Please wait a few minutes and try again.",
};

function readSession() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch (e) { return null; }
}
function writeSession(s) {
  try {
    if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s));
    else localStorage.removeItem(AUTH_KEY);
  } catch (e) {}
}

async function authPost(url, body, form) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
    body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = String((data.error && data.error.message) || "").split(" ")[0];
    const err = new Error(AUTH_ERRORS[code] || "Sign-in failed. Please try again.");
    err.code = code;
    throw err;
  }
  return data;
}

export const auth = {
  required: AUTH_REQUIRED,

  user() {
    const s = readSession();
    return s ? { email: s.email } : null;
  },

  async signIn(email, password) {
    const d = await authPost(
      "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + FIREBASE_API_KEY,
      { email, password, returnSecureToken: true }
    );
    writeSession({
      email: d.email,
      idToken: d.idToken,
      refreshToken: d.refreshToken,
      expiresAt: Date.now() + Number(d.expiresIn) * 1000,
    });
    return { email: d.email };
  },

  signOut() { writeSession(null); },

  // A valid ID token, refreshed when it's within a minute of expiring.
  async getIdToken() {
    const s = readSession();
    if (!s) return null;
    if (s.expiresAt - 60000 > Date.now()) return s.idToken;
    try {
      const d = await authPost(
        "https://securetoken.googleapis.com/v1/token?key=" + FIREBASE_API_KEY,
        { grant_type: "refresh_token", refresh_token: s.refreshToken },
        true
      );
      writeSession({
        ...s,
        idToken: d.id_token,
        refreshToken: d.refresh_token,
        expiresAt: Date.now() + Number(d.expires_in) * 1000,
      });
      return d.id_token;
    } catch (e) {
      writeSession(null);
      return null;
    }
  },
};
