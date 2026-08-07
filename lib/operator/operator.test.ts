import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runOperator } from '@/lib/operator';
import { SqliteStore } from '@/lib/store/sqlite';
import type { LLMProvider, LLMRequest } from '@/lib/llm/provider';
import type { Store } from '@/lib/store/store';

function cannedProvider(...responses: string[]): LLMProvider {
  let call = 0;
  return {
    name: 'canned',
    async complete() {
      const response = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return response;
    },
  };
}

const CREATE_BATCH = JSON.stringify([
  {
    op: 'createSurface',
    title: 'Job search',
    icon: '💼',
    viewType: 'board',
    fields: [
      { key: 'company', label: 'Company', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'stage', label: 'Stage', type: 'status', options: ['Researching', 'Applied', 'Interview', 'Offer'] },
      { key: 'next', label: 'Next step', type: 'date' },
    ],
    narration: 'A board that tracks every application by stage.',
  },
  // references the surface created above by title, not id
  { op: 'addRecord', surface: 'Job search', values: { company: 'Linear', role: 'Product Manager', stage: 'Interview', next: '2026-08-13' } },
  { op: 'addRecord', surface: 'job search', values: { company: 'Figma', role: 'Product Designer', stage: 'Applied', next: null, bogusKey: 'dropped' } },
]);

describe('runOperator', () => {
  let dir: string;
  let store: Store;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otto-test-'));
    store = new SqliteStore(path.join(dir, 'test.db'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates a surface and its records from one batch, resolving title references', async () => {
    const result = await runOperator(store, cannedProvider(CREATE_BATCH), 'help me run my job search');

    expect(result.fallback).toBe(false);
    expect(result.createdSurfaceIds).toHaveLength(1);
    expect(result.reply).toContain('A board that tracks every application by stage.');
    expect(result.reply).toContain('Added 2 items');

    const surfaces = await store.listSurfaces();
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0].viewType).toBe('board');

    const records = await store.listRecords(surfaces[0].id);
    expect(records).toHaveLength(2);
    // values are filtered to the surface's declared field keys
    expect(records[1].values).toEqual({ company: 'Figma', role: 'Product Designer', stage: 'Applied', next: null });
  });

  it('writes one undoable change-log entry per applied mutation', async () => {
    await runOperator(store, cannedProvider(CREATE_BATCH), 'help me run my job search');

    const changes = await store.listChanges();
    expect(changes).toHaveLength(3);
    const inverses = changes.map((c) => (c.inverse as { op: string }).op).sort();
    expect(inverses).toEqual(['deleteRecord', 'deleteRecord', 'deleteSurface']);
  });

  it('answers without touching data', async () => {
    const result = await runOperator(
      store,
      cannedProvider(JSON.stringify([{ op: 'answer', text: 'You have nothing due this week.' }])),
      'anything due?',
    );

    expect(result.reply).toBe('You have nothing due this week.');
    expect(result.appliedCount).toBe(0);
    expect(await store.listSurfaces()).toHaveLength(0);
  });

  it('recovers via retry when the first response is invalid', async () => {
    const result = await runOperator(
      store,
      cannedProvider('Sure, will do!', CREATE_BATCH),
      'help me run my job search',
    );

    expect(result.fallback).toBe(false);
    expect(await store.listSurfaces()).toHaveLength(1);
  });

  it('falls back to a rephrase request when the model never validates', async () => {
    const result = await runOperator(
      store,
      cannedProvider('nonsense', 'more nonsense'),
      'help me run my job search',
    );

    expect(result.fallback).toBe(true);
    expect(result.reply).toContain('say it a little differently');
    expect(await store.listSurfaces()).toHaveLength(0);
  });

  it('passes conversation history to the provider ahead of the new message', async () => {
    const seen: LLMRequest[] = [];
    const capturing: LLMProvider = {
      name: 'capturing',
      async complete(request) {
        seen.push(request);
        return JSON.stringify([{ op: 'answer', text: 'ok' }]);
      },
    };
    const history = [
      { role: 'user' as const, content: 'help me run my job search' },
      { role: 'assistant' as const, content: '[{"op":"createSurface","title":"Job search", ...}]' },
    ];

    await runOperator(store, capturing, 'add Vercel to it', history);

    expect(seen[0].messages).toHaveLength(3);
    expect(seen[0].messages[0]).toEqual(history[0]);
    expect(seen[0].messages[1]).toEqual(history[1]);
    expect(seen[0].messages[2]).toEqual({ role: 'user', content: 'add Vercel to it' });
  });

  it('holds draftAction for approval instead of applying it', async () => {
    const result = await runOperator(
      store,
      cannedProvider(
        JSON.stringify([
          { op: 'draftAction', kind: 'deleteSurface', description: 'Delete the Job search board', payload: { surface: 'Job search' } },
        ]),
      ),
      'delete my job search board',
    );

    expect(result.appliedCount).toBe(0);
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].kind).toBe('deleteSurface');
  });
});
