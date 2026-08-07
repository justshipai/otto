import type { Surface, SurfaceRecord } from '@/lib/core/types';
import type { Store } from '@/lib/store/store';

/**
 * Seeds one realistic surface so every screen looks alive on first run,
 * before the user has connected an LLM. Delete data/otto.db to start fresh.
 *
 * The overdue invoice is deliberate: milestone 7's proactive check will
 * surface it under "Needs attention" on Home.
 */
export async function seedIfEmpty(store: Store): Promise<void> {
  const existing = await store.listSurfaces();
  if (existing.length > 0) {
    return;
  }

  const now = new Date();
  const iso = now.toISOString();
  const daysFromNow = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const surface: Surface = {
    id: crypto.randomUUID(),
    title: 'Clients who owe me money',
    icon: '💸',
    viewType: 'table',
    fields: [
      { key: 'client', label: 'Client', type: 'text' },
      { key: 'project', label: 'Project', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'money' },
      { key: 'due', label: 'Due date', type: 'date' },
      { key: 'status', label: 'Status', type: 'status', options: ['Draft', 'Sent', 'Overdue', 'Paid'] },
    ],
    pinned: true,
    createdAt: iso,
    updatedAt: iso,
  };

  const rows: SurfaceRecord['values'][] = [
    { client: 'Harbour & Finch', project: 'Brand refresh', amount: 3200, due: daysFromNow(-12), status: 'Overdue' },
    { client: 'Maple Yoga Studio', project: 'Class booking site', amount: 1850, due: daysFromNow(9), status: 'Sent' },
    { client: 'Oro Coffee Roasters', project: 'Packaging photos', amount: 740, due: daysFromNow(21), status: 'Sent' },
    { client: 'Fieldnote Films', project: 'Showreel edit', amount: 2400, due: daysFromNow(-3), status: 'Paid' },
    { client: 'Bright & Early Bakery', project: 'Menu redesign', amount: 980, due: daysFromNow(30), status: 'Draft' },
  ];

  await store.createSurface(surface);
  for (const values of rows) {
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
    summary: `Set up "${surface.title}" with ${rows.length} invoices (demo data)`,
    operation: {
      op: 'createSurface',
      title: surface.title,
      icon: surface.icon,
      viewType: surface.viewType,
      fields: surface.fields,
      narration: 'A table to track outstanding invoices, with amounts, due dates and payment status.',
    },
    inverse: { op: 'deleteSurface', surfaceId: surface.id },
  });
}
