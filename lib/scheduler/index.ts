/**
 * The proactive side of Otto: a periodic in-process check that evaluates
 * enabled automations and marks surfaces as needing attention (e.g. an
 * invoice's due date passed). Runs inside the Next.js server process —
 * started once from instrumentation.ts — so `npm run dev` is still the
 * only command a user runs.
 *
 * Milestone 7 implements the tick; until then this is just the seam.
 */
export function startScheduler(): void {
  // intentionally empty until milestone 7 (automations + proactive check)
}
