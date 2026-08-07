import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAttentionItems } from '@/lib/attention';
import { SqliteStore } from '@/lib/store/sqlite';
import type { Automation, Surface } from '@/lib/core/types';
import type { Store } from '@/lib/store/store';

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('getAttentionItems', () => {
  let dir: string;
  let store: Store;
  let surface: Surface;

  async function addAutomation(trigger: Automation['trigger'], enabled = true): Promise<Automation> {
    const automation: Automation = {
      id: crypto.randomUUID(),
      surfaceId: surface.id,
      kind: 'watch',
      trigger,
      action: { kind: 'notify', message: 'Look at this.' },
      enabled,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.createAutomation(automation);
    return automation;
  }

  async function addRecord(values: Record<string, string | number | null>) {
    await store.createRecord({
      id: crypto.randomUUID(),
      surfaceId: surface.id,
      values,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otto-attention-'));
    store = new SqliteStore(path.join(dir, 'test.db'));
    surface = {
      id: crypto.randomUUID(),
      title: 'Invoices',
      icon: '💸',
      viewType: 'table',
      fields: [
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'due', label: 'Due', type: 'date' },
        { key: 'status', label: 'Status', type: 'status', options: ['Sent', 'Paid'] },
      ],
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.createSurface(surface);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("matches 'past' dates and counts them in the message", async () => {
    await addAutomation({ fieldKey: 'due', condition: 'past' });
    await addRecord({ client: 'A', due: isoDaysFromNow(-10), status: 'Sent' });
    await addRecord({ client: 'B', due: isoDaysFromNow(-1), status: 'Sent' });
    await addRecord({ client: 'C', due: isoDaysFromNow(5), status: 'Sent' });
    await addRecord({ client: 'D', due: null, status: 'Sent' });

    const items = await getAttentionItems(store);

    expect(items).toHaveLength(1);
    expect(items[0].matchCount).toBe(2);
    expect(items[0].message).toBe('Look at this. (2 items)');
    expect(items[0].surface.title).toBe('Invoices');
  });

  it("matches 'today', 'withinDays' and 'equals'", async () => {
    await addRecord({ client: 'A', due: isoDaysFromNow(0), status: 'Sent' });
    await addRecord({ client: 'B', due: isoDaysFromNow(3), status: 'Paid' });

    const todayAuto = await addAutomation({ fieldKey: 'due', condition: 'today' });
    const withinAuto = await addAutomation({ fieldKey: 'due', condition: 'withinDays', value: 7 });
    const equalsAuto = await addAutomation({ fieldKey: 'status', condition: 'equals', value: 'Paid' });

    const items = await getAttentionItems(store);
    const byId = new Map(items.map((i) => [i.automation.id, i.matchCount]));

    expect(byId.get(todayAuto.id)).toBe(1);
    expect(byId.get(withinAuto.id)).toBe(2); // today and +3 both inside 7 days
    expect(byId.get(equalsAuto.id)).toBe(1);
  });

  it('ignores disabled automations and empty matches', async () => {
    await addAutomation({ fieldKey: 'due', condition: 'past' }, false);
    await addAutomation({ fieldKey: 'due', condition: 'today' });
    await addRecord({ client: 'A', due: isoDaysFromNow(9), status: 'Sent' });

    expect(await getAttentionItems(store)).toHaveLength(0);
  });
});
