import type { Field, Surface, SurfaceRecord, ViewType } from '@/lib/core/types';
import type { Store } from '@/lib/store/store';

/**
 * Seeds three realistic solo-operator surfaces — one per view type, across
 * work and life, because Otto is generic by design — so every screen looks
 * alive on first run, before an LLM is even connected. Delete data/otto.db
 * to start fresh.
 *
 * The overdue invoice is deliberate: milestone 7's proactive check will
 * surface it under "Needs attention" on Home.
 */

interface SeedSurface {
  title: string;
  icon: string;
  viewType: ViewType;
  pinned: boolean;
  narration: string;
  fields: Field[];
  rows: SurfaceRecord['values'][];
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const SEED: SeedSurface[] = [
  {
    title: 'Clients who owe me money',
    icon: '💸',
    viewType: 'table',
    pinned: true,
    narration: 'A table to track outstanding invoices, with amounts, due dates and payment status.',
    fields: [
      { key: 'client', label: 'Client', type: 'text' },
      { key: 'project', label: 'Project', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'money' },
      { key: 'due', label: 'Due date', type: 'date' },
      { key: 'status', label: 'Status', type: 'status', options: ['Draft', 'Sent', 'Overdue', 'Paid'] },
    ],
    rows: [
      { client: 'Harbour & Finch', project: 'Brand refresh', amount: 3200, due: daysFromNow(-12), status: 'Overdue' },
      { client: 'Maple Yoga Studio', project: 'Class booking site', amount: 1850, due: daysFromNow(9), status: 'Sent' },
      { client: 'Oro Coffee Roasters', project: 'Packaging photos', amount: 740, due: daysFromNow(21), status: 'Sent' },
      { client: 'Fieldnote Films', project: 'Showreel edit', amount: 2400, due: daysFromNow(-3), status: 'Paid' },
      { client: 'Bright & Early Bakery', project: 'Menu redesign', amount: 980, due: daysFromNow(30), status: 'Draft' },
    ],
  },
  {
    title: 'Content plan',
    icon: '📣',
    viewType: 'board',
    pinned: false,
    narration: 'A board that moves each piece of content from idea to posted.',
    fields: [
      { key: 'idea', label: 'Idea', type: 'text' },
      { key: 'stage', label: 'Stage', type: 'status', options: ['Idea', 'Drafting', 'Scheduled', 'Posted'] },
      { key: 'channel', label: 'Channel', type: 'select', options: ['Newsletter', 'Instagram', 'YouTube', 'Blog'] },
      { key: 'when', label: 'When', type: 'date' },
    ],
    rows: [
      { idea: 'Client onboarding checklist', stage: 'Posted', channel: 'Blog', when: daysFromNow(-6) },
      { idea: 'Studio tour reel', stage: 'Scheduled', channel: 'Instagram', when: daysFromNow(2) },
      { idea: 'Pricing myths newsletter', stage: 'Drafting', channel: 'Newsletter', when: daysFromNow(5) },
      { idea: 'Before/after: bakery rebrand', stage: 'Drafting', channel: 'Instagram', when: daysFromNow(8) },
      { idea: 'How I scope a project', stage: 'Idea', channel: 'YouTube', when: null },
      { idea: 'Tools I actually use', stage: 'Idea', channel: 'Newsletter', when: null },
    ],
  },
  {
    title: 'House move',
    icon: '📦',
    viewType: 'list',
    pinned: false,
    narration: 'A checklist for the move, with dates and what is already booked.',
    fields: [
      { key: 'task', label: 'Task', type: 'text' },
      { key: 'when', label: 'When', type: 'date' },
      { key: 'state', label: 'State', type: 'status', options: ['To do', 'Booked', 'Done'] },
    ],
    rows: [
      { task: 'Give notice on the flat', when: daysFromNow(-9), state: 'Done' },
      { task: 'Book the movers', when: daysFromNow(4), state: 'Booked' },
      { task: 'Order packing boxes', when: daysFromNow(6), state: 'To do' },
      { task: 'Transfer internet', when: daysFromNow(15), state: 'To do' },
      { task: 'Update address everywhere', when: daysFromNow(24), state: 'To do' },
    ],
  },
];

export async function seedIfEmpty(store: Store): Promise<void> {
  const existing = await store.listSurfaces();
  if (existing.length > 0) {
    return;
  }

  const base = Date.now();
  for (const [index, seed] of SEED.entries()) {
    // stagger timestamps so creation order (Library) and recency (Home) are stable
    const iso = new Date(base + index * 1000).toISOString();
    const surface: Surface = {
      id: crypto.randomUUID(),
      title: seed.title,
      icon: seed.icon,
      viewType: seed.viewType,
      fields: seed.fields,
      pinned: seed.pinned,
      createdAt: iso,
      updatedAt: iso,
    };
    await store.createSurface(surface);
    for (const values of seed.rows) {
      await store.createRecord({
        id: crypto.randomUUID(),
        surfaceId: surface.id,
        values,
        createdAt: iso,
        updatedAt: iso,
      });
    }
    await store.appendChange({
      id: crypto.randomUUID(),
      createdAt: iso,
      summary: `Set up "${seed.title}" with ${seed.rows.length} items (demo data)`,
      operation: {
        op: 'createSurface',
        title: seed.title,
        icon: seed.icon,
        viewType: seed.viewType,
        fields: seed.fields,
        narration: seed.narration,
      },
      inverse: { op: 'deleteSurface', surfaceId: surface.id },
    });
  }
}
