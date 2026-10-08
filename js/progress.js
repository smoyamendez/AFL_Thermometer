// Shared number handling for both pages.

export function normalize(s) {
  const raised = Math.max(0, Math.round(Number(s && s.raised) || 0));
  const goal = Math.max(1, Math.round(Number(s && s.goal) || 1));
  return { raised, goal };
}

// Fraction 0..1 of the goal reached. Overfunding caps at 1 (full tube);
// the true dollar amount is still shown.
export function progress(s) {
  const { raised, goal } = normalize(s);
  return Math.min(1, raised / goal);
}

export const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
