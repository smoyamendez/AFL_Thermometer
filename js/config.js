// ============================================================================
//  Site configuration. See README.md → "Going live" for setup steps.
//
//  Leave FIREBASE_DB_URL empty to run in LOCAL mode (this browser only;
//  handy for development). Fill both values in to go live.
// ============================================================================

// Firebase Realtime Database URL,
// e.g. "https://afl-paint-fund-default-rtdb.firebaseio.com"
export const FIREBASE_DB_URL = "https://afl-thermometer-default-rtdb.firebaseio.com/";

// Firebase Web API key (Project settings → General → Web API key).
// Used only for staff sign-in on the admin page. It is not a secret;
// the database rules are what keep writes staff-only.
export const FIREBASE_API_KEY = "AIzaSyBgdhpEgnwhqZB5vmzMNRqo11zbz5zBRT0";

// Placeholder values (from the design). Shown until the database has a record,
// and used to seed an empty database. Staff can change them from the admin page.
export const DEFAULTS = { raised: 9250, goal: 15000 };
