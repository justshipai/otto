import type { Automation, Field, Surface, SurfaceRecord, ViewType } from '@/lib/core/types';
import type { Store } from '@/lib/store/store';

/**
 * First-run starters: the cross-domain examples behind the chips on the
 * empty Home screen. Picking one materializes a real, live surface —
 * records, an automation that has something to say right away (the first
 * proactive nudge), a change-log batch — with no LLM call, so first run
 * works before any API key is configured.
 *
 * These are EXAMPLES, not vertical templates: each is plain seed data for
 * the same five generic entities, and the moment it exists the user
 * reshapes it by talking like anything else. Deliberately one per corner
 * of life (money, content, work search, home) to show Otto is generic.
 */

export interface Starter {
  key: string;
  chip: string;
  title: string;
  icon: string;
  viewType: ViewType;
  narration: string;
  fields: Field[];
  rows: SurfaceRecord['values'][];
  automation: Pick<Automation, 'kind' | 'trigger' | 'action'>;
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const STARTERS: Starter[] = [
  {
    key: 'invoices',
    chip: 'Clients who owe me money',
    title: 'Clients who owe me money',
    icon: '💸',
    viewType: 'table',
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
      { client: 'Fieldnote Films', project: 'Showreel edit', amount: 2400, due: daysFromNow(3), status: 'Paid' },
      { client: 'Bright & Early Bakery', project: 'Menu redesign', amount: 980, due: daysFromNow(30), status: 'Draft' },
    ],
    automation: {
      kind: 'watch',
      trigger: { fieldKey: 'due', condition: 'past' },
      action: { kind: 'notify', message: 'An invoice is past due — time to chase it.' },
    },
  },
  {
    key: 'content',
    chip: 'Planning my content',
    title: 'Content plan',
    icon: '📣',
    viewType: 'board',
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
      { idea: 'How I scope a project', stage: 'Idea', channel: 'YouTube', when: null },
      { idea: 'Tools I actually use', stage: 'Idea', channel: 'Newsletter', when: null },
    ],
    automation: {
      kind: 'reminder',
      trigger: { fieldKey: 'when', condition: 'withinDays', value: 3 },
      action: { kind: 'notify', message: 'Content is due to go out in the next few days.' },
    },
  },
  {
    key: 'jobs',
    chip: 'A job search',
    title: 'Job search',
    icon: '💼',
    viewType: 'board',
    narration: 'A board that tracks every application by stage, so nothing slips.',
    fields: [
      { key: 'company', label: 'Company', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'stage', label: 'Stage', type: 'status', options: ['Researching', 'Applied', 'Interview', 'Offer'] },
      { key: 'next', label: 'Next step', type: 'date' },
    ],
    rows: [
      { company: 'Linear', role: 'Product Manager', stage: 'Interview', next: daysFromNow(1) },
      { company: 'Figma', role: 'Product Designer', stage: 'Applied', next: null },
      { company: 'Notion', role: 'PM', stage: 'Researching', next: null },
    ],
    automation: {
      kind: 'reminder',
      trigger: { fieldKey: 'next', condition: 'withinDays', value: 2 },
      action: { kind: 'notify', message: 'An interview is coming up — get prepping.' },
    },
  },
  {
    key: 'move',
    chip: 'A house move',
    title: 'House move',
    icon: '📦',
    viewType: 'list',
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
    automation: {
      kind: 'reminder',
      trigger: { fieldKey: 'when', condition: 'withinDays', value: 7 },
      action: { kind: 'notify', message: 'Move tasks are coming up this week.' },
    },
  },
];

export async function materializeStarter(store: Store, key: string): Promise<Surface> {
  const starter = STARTERS.find((s) => s.key === key);
  if (!starter) {
    throw new Error('Unknown starter.');
  }

  const now = new Date().toISOString();
  const surface: Surface = {
    id: crypto.randomUUID(),
    title: starter.title,
    icon: starter.icon,
    viewType: starter.viewType,
    fields: starter.fields,
    pinned: true,
    createdAt: now,
    updatedAt: now,
  };
  await store.createSurface(surface);
  for (const values of starter.rows) {
    await store.createRecord({ id: crypto.randomUUID(), surfaceId: surface.id, values, createdAt: now, updatedAt: now });
  }
  await store.createAutomation({
    id: crypto.randomUUID(),
    surfaceId: surface.id,
    ...starter.automation,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  await store.appendChange({
    id: crypto.randomUUID(),
    batchId: crypto.randomUUID(),
    createdAt: now,
    summary: `Started with "${starter.title}" (${starter.rows.length} example items)`,
    operation: {
      op: 'createSurface',
      title: starter.title,
      icon: starter.icon,
      viewType: starter.viewType,
      fields: starter.fields,
      narration: starter.narration,
    },
    inverse: { op: 'deleteSurface', surfaceId: surface.id },
  });
  return surface;
}
