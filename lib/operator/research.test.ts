import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runOperator } from '@/lib/operator';
import { SqliteStore } from '@/lib/store/sqlite';
import type { ResearchExecutor, ResearchOp } from '@/lib/operator/research';
import type { LLMProvider } from '@/lib/llm/provider';
import type { Store } from '@/lib/store/store';

function scriptedProvider(...responses: string[]): LLMProvider {
  let call = 0;
  return {
    name: 'scripted',
    async complete() {
      const response = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return response;
    },
  };
}

function fakeExecutor(results: Record<string, string>): ResearchExecutor & { calls: ResearchOp[] } {
  const calls: ResearchOp[] = [];
  return {
    mode: 'brave',
    calls,
    async execute(op) {
      calls.push(op);
      return results[op.op === 'webSearch' ? op.query : op.url] ?? '{"error":"no fake result"}';
    },
  };
}

const DOC_BATCH = JSON.stringify([
  {
    op: 'createSurface',
    title: 'Murphy AI interview prep',
    icon: '📄',
    viewType: 'doc',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'body', label: 'Body', type: 'longtext' },
    ],
    narration: 'A prep doc pulling together what the web says about Murphy AI.',
  },
  { op: 'addRecord', surface: 'Murphy AI interview prep', values: { heading: 'The company', body: 'Murphy AI raised $40M (source: example.com/news).' } },
  { op: 'addRecord', surface: 'Murphy AI interview prep', values: { heading: 'Questions to ask', body: 'How is the Series A being deployed?' } },
]);

describe('research loop', () => {
  let dir: string;
  let store: Store;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otto-research-'));
    store = new SqliteStore(path.join(dir, 'test.db'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('executes search then readPage then applies the final doc', async () => {
    const executor = fakeExecutor({
      'Murphy AI news': JSON.stringify({ results: [{ title: 'Murphy AI raises $40M', url: 'https://example.com/news', snippet: '…' }] }),
      'https://example.com/news': JSON.stringify({ title: 'Murphy AI raises $40M', text: 'Murphy AI, founded 2024…' }),
    });
    const provider = scriptedProvider(
      JSON.stringify([{ op: 'webSearch', query: 'Murphy AI news' }]),
      JSON.stringify([{ op: 'readPage', url: 'https://example.com/news' }]),
      DOC_BATCH,
    );

    const result = await runOperator(store, provider, 'scan the web for Murphy AI news and write a prep doc', [], executor);

    expect(executor.calls.map((c) => c.op)).toEqual(['webSearch', 'readPage']);
    expect(result.createdSurfaceIds).toHaveLength(1);
    const [surface] = await store.listSurfaces();
    expect(surface.viewType).toBe('doc');
    expect(await store.listRecords(surface.id)).toHaveLength(2);
    expect(result.reply).toContain('prep doc');
  });

  it('research requests never touch the store, even mixed with other ops', async () => {
    const executor = fakeExecutor({ q: '{"results":[]}' });
    const provider = scriptedProvider(
      // request + mutation in one response: the mutation must NOT apply this round
      JSON.stringify([
        { op: 'webSearch', query: 'q' },
        { op: 'addRecord', surface: 'nope', values: { a: 1 } },
      ]),
      JSON.stringify([{ op: 'answer', text: 'All done.' }]),
    );

    const result = await runOperator(store, provider, 'look this up', [], executor);

    expect(result.appliedCount).toBe(0);
    expect(result.reply).toBe('All done.');
    expect(await store.listChanges()).toHaveLength(0);
  });

  it('stops after the round budget and answers honestly', async () => {
    const executor = fakeExecutor({ loop: '{"results":[]}' });
    const provider = scriptedProvider(JSON.stringify([{ op: 'webSearch', query: 'loop' }]));

    const result = await runOperator(store, provider, 'research forever', [], executor);

    expect(result.fallback).toBe(true);
    expect(result.appliedCount).toBe(0);
    expect(executor.calls.length).toBeLessThanOrEqual(7);
    expect(result.reply.length).toBeGreaterThan(0);
  });

  it('refuses politely when research is disabled', async () => {
    const disabled: ResearchExecutor = {
      mode: 'none',
      execute: async () => 'Research is switched off in Settings, so this request was not run.',
    };
    const provider = scriptedProvider(
      JSON.stringify([{ op: 'webSearch', query: 'anything' }]),
      JSON.stringify([{ op: 'answer', text: 'Research is off — you can enable it in Settings.' }]),
    );

    const result = await runOperator(store, provider, 'look this up', [], disabled);

    expect(result.reply).toContain('Settings');
    expect(await store.listChanges()).toHaveLength(0);
  });
});
