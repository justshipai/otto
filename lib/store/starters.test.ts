import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAttentionItems } from '@/lib/attention';
import { SqliteStore } from '@/lib/store/sqlite';
import { STARTERS, materializeStarter } from '@/lib/store/starters';
import type { Store } from '@/lib/store/store';

describe('starters', () => {
  let dir: string;
  let store: Store;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otto-starters-'));
    store = new SqliteStore(path.join(dir, 'test.db'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('every starter materializes a surface, records, automation and an undoable change-log batch', async () => {
    for (const starter of STARTERS) {
      const fresh = new SqliteStore(path.join(dir, `${starter.key}.db`));
      const surface = await materializeStarter(fresh, starter.key);

      expect((await fresh.listSurfaces())[0].id).toBe(surface.id);
      expect(await fresh.listRecords(surface.id)).toHaveLength(starter.rows.length);
      expect(await fresh.listAutomations(surface.id)).toHaveLength(1);
      const [entry] = await fresh.listChanges(1);
      expect(entry.summary).toContain(starter.title);
      expect(entry.inverse).toEqual({ op: 'deleteSurface', surfaceId: surface.id });
    }
  });

  it('every starter fires a proactive nudge immediately', async () => {
    for (const starter of STARTERS) {
      const fresh = new SqliteStore(path.join(dir, `nudge-${starter.key}.db`));
      await materializeStarter(fresh, starter.key);
      const items = await getAttentionItems(fresh);
      expect(items.length, `starter "${starter.key}" should nudge on day one`).toBeGreaterThan(0);
    }
  });

  it('rejects unknown starter keys', async () => {
    await expect(materializeStarter(store, 'nonsense')).rejects.toThrow('Unknown starter');
  });
});
