import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runOperator } from '@/lib/operator';
import { applyDraft } from '@/lib/operator/drafts';
import { undoBatch } from '@/lib/operator/undo';
import { SqliteStore } from '@/lib/store/sqlite';
import type { LLMProvider } from '@/lib/llm/provider';
import type { Store } from '@/lib/store/store';

function cannedProvider(response: string): LLMProvider {
  return { name: 'canned', complete: async () => response };
}

const CREATE_BATCH = JSON.stringify([
  {
    op: 'createSurface',
    title: 'Job search',
    icon: '💼',
    viewType: 'board',
    fields: [
      { key: 'company', label: 'Company', type: 'text' },
      { key: 'stage', label: 'Stage', type: 'status', options: ['Applied', 'Interview'] },
    ],
    narration: 'A board for applications.',
  },
  { op: 'addRecord', surface: 'Job search', values: { company: 'Linear', stage: 'Interview' } },
  { op: 'addRecord', surface: 'Job search', values: { company: 'Figma', stage: 'Applied' } },
]);

describe('undo and approved drafts', () => {
  let dir: string;
  let store: Store;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otto-undo-'));
    store = new SqliteStore(path.join(dir, 'test.db'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('undoes a creation batch completely, and the undo is itself logged', async () => {
    const run = await runOperator(store, cannedProvider(CREATE_BATCH), 'track my job search');
    expect(await store.listSurfaces()).toHaveLength(1);

    const undone = await undoBatch(store, run.batchId);

    expect(await store.listSurfaces()).toHaveLength(0);
    expect(undone.summaries.length).toBeGreaterThan(0);
    const changes = await store.listChanges();
    // 3 original entries + 3 undo entries
    expect(changes).toHaveLength(6);
    expect(changes[0].summary).toContain('Undid:');
  });

  it('undoing an undo restores everything (redo)', async () => {
    const run = await runOperator(store, cannedProvider(CREATE_BATCH), 'track my job search');
    const undone = await undoBatch(store, run.batchId);

    await undoBatch(store, undone.batchId);

    const surfaces = await store.listSurfaces();
    expect(surfaces).toHaveLength(1);
    expect(await store.listRecords(surfaces[0].id)).toHaveLength(2);
  });

  it('an approved deleteSurface draft is undoable, restoring the surface whole', async () => {
    await runOperator(store, cannedProvider(CREATE_BATCH), 'track my job search');
    const [surface] = await store.listSurfaces();

    const applied = await applyDraft(store, {
      op: 'draftAction',
      kind: 'deleteSurface',
      description: 'Delete the Job search board',
      payload: { surface: surface.title },
    });
    expect(await store.listSurfaces()).toHaveLength(0);

    await undoBatch(store, applied.batchId);

    const restored = await store.listSurfaces();
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(surface.id);
    expect(await store.listRecords(surface.id)).toHaveLength(2);
  });

  it('migrates pre-batch change logs so each legacy entry is its own batch', async () => {
    // build a database with the old change_log shape (no batch_id)
    const legacyPath = path.join(dir, 'legacy.db');
    const Database = (await import('better-sqlite3')).default;
    const raw = new Database(legacyPath);
    raw.exec(`CREATE TABLE change_log (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, summary TEXT NOT NULL,
      operation_json TEXT NOT NULL, inverse_json TEXT NOT NULL
    )`);
    const insert = raw.prepare('INSERT INTO change_log VALUES (?, ?, ?, ?, ?)');
    insert.run('a', '2026-01-01T00:00:00Z', 'one', '{}', '{"op":"none"}');
    insert.run('b', '2026-01-02T00:00:00Z', 'two', '{}', '{"op":"none"}');
    raw.close();

    const migrated = new SqliteStore(legacyPath);
    const changes = await migrated.listChanges();
    const batchIds = new Set(changes.map((c) => c.batchId));
    // one batch PER legacy entry — a shared batch would make one undo replay all of history
    expect(batchIds.size).toBe(2);
    expect(batchIds.has('')).toBe(false);
  });

  it('rejects drafts with missing payload details', async () => {
    await expect(
      applyDraft(store, { op: 'draftAction', kind: 'deleteRecord', description: 'Remove it', payload: {} }),
    ).rejects.toThrow();
    await expect(
      applyDraft(store, { op: 'draftAction', kind: 'sendMessage', description: 'Chase invoice', payload: { to: 'x@y.com' } }),
    ).rejects.toThrow();
  });

  it('sendMessage drafts apply via the stub sender with a no-op inverse', async () => {
    const applied = await applyDraft(store, {
      op: 'draftAction',
      kind: 'sendMessage',
      description: 'Chase the overdue invoice',
      payload: { to: 'accounts@harbourfinch.com', subject: 'Invoice', body: 'Friendly nudge.' },
    });

    expect(applied.reply).toContain('sent');
    const [entry] = await store.listChanges(1);
    expect(entry.summary).toContain('no real delivery');
    expect(entry.inverse).toEqual({ op: 'none' });
  });
});
