import type { Automation, Surface, SurfaceRecord } from '@/lib/core/types';
import type { Store } from '@/lib/store/store';

/**
 * What deserves the top of Home: every enabled automation whose trigger
 * currently matches at least one record. This is evaluated LIVE wherever
 * it's needed — Home reads it on every render (so it's never stale) and
 * the scheduler reads it on a timer to announce newly-triggered items
 * (lib/scheduler). Nothing is stored; attention is a view, not state.
 */

export interface AttentionItem {
  surface: Surface;
  automation: Automation;
  matchCount: number;
  message: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function recordMatches(automation: Automation, record: SurfaceRecord): boolean {
  const value = record.values[automation.trigger.fieldKey];
  if (value === null || value === undefined || value === '') {
    return false;
  }
  const now = today();
  switch (automation.trigger.condition) {
    case 'past':
      return String(value) < now;
    case 'today':
      return String(value) === now;
    case 'withinDays': {
      const days = Number(automation.trigger.value ?? 0);
      return String(value) >= now && String(value) <= addDays(now, Number.isFinite(days) ? days : 0);
    }
    case 'equals':
      return value === automation.trigger.value;
  }
}

export async function getAttentionItems(store: Store): Promise<AttentionItem[]> {
  const automations = (await store.listAutomations()).filter((a) => a.enabled);
  if (automations.length === 0) {
    return [];
  }

  const surfaces = await store.listSurfaces();
  const surfaceById = new Map(surfaces.map((s) => [s.id, s]));
  const recordCache = new Map<string, SurfaceRecord[]>();

  const items: AttentionItem[] = [];
  for (const automation of automations) {
    const surface = surfaceById.get(automation.surfaceId);
    if (!surface) {
      continue;
    }
    if (!recordCache.has(surface.id)) {
      recordCache.set(surface.id, await store.listRecords(surface.id));
    }
    const matches = recordCache.get(surface.id)!.filter((record) => recordMatches(automation, record));
    if (matches.length === 0) {
      continue;
    }
    items.push({
      surface,
      automation,
      matchCount: matches.length,
      message:
        matches.length === 1
          ? automation.action.message
          : `${automation.action.message} (${matches.length} items)`,
    });
  }
  return items;
}
