import { getAttentionItems } from '@/lib/attention';
import { getStore } from '@/lib/store';

/**
 * The proactive side of Otto: a periodic in-process check that evaluates
 * enabled automations. Home reads the same evaluation live, so the UI is
 * never stale — the scheduler's job is to notice NEW triggers between
 * page loads and announce them (today: a server log line; this is the
 * seam where desktop/push notifications would plug in).
 *
 * Runs inside the Next.js server process, started once from
 * instrumentation.ts, so `npm run dev` stays the only command.
 */

const TICK_MS = 60_000;

const globalFlags = globalThis as typeof globalThis & { __ottoSchedulerStarted?: boolean };
const announced = new Set<string>();

async function tick(firstRun: boolean): Promise<void> {
  try {
    const store = await getStore();
    const items = await getAttentionItems(store);
    const current = new Set<string>();
    for (const item of items) {
      const key = `${item.automation.id}:${item.matchCount}`;
      current.add(key);
      if (!announced.has(key) && !firstRun) {
        console.log(`otto: needs attention — ${item.message} ("${item.surface.title}")`);
      }
    }
    announced.clear();
    for (const key of current) {
      announced.add(key);
    }
  } catch (error) {
    console.warn('otto: proactive check failed', error);
  }
}

export function startScheduler(): void {
  // dev-mode hot reloads call register() again; never stack intervals
  if (globalFlags.__ottoSchedulerStarted) {
    return;
  }
  globalFlags.__ottoSchedulerStarted = true;
  void tick(true);
  const interval = setInterval(() => void tick(false), TICK_MS);
  interval.unref?.();
}
