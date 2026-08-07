import { readResearchConfig } from '@/lib/config';
import { createSearchProvider } from '@/lib/search';
import { readPage } from '@/lib/search/read-page';
import type { Operation } from '@/lib/core/operations';

/**
 * Executes the model's research REQUEST operations (webSearch, readPage).
 * These are the model asking Otto to look something up: they never touch
 * the store, results go back into the conversation as data, and the loop
 * in lib/operator/index.ts caps how many rounds a request can take.
 *
 * Three research modes (Settings):
 * - 'none'  — off (default); requests are refused with an explanation
 * - 'model' — the LLM provider's own built-in search does the looking-up
 *   inside the completion itself (no extra key); the request ops aren't
 *   advertised and are refused if emitted anyway
 * - 'brave' — Otto runs requests through the SearchProvider seam; works
 *   with any model, including local ones
 *
 * Results are wrapped with an explicit reminder that web content is
 * untrusted data — but the real defenses are structural: whatever the
 * model concludes, its output still has to pass the operation schema,
 * destructive/outbound ops still become drafts, and everything is undoable.
 */

export type ResearchMode = 'none' | 'model' | 'brave';

export type ResearchOp = Extract<Operation, { op: 'webSearch' | 'readPage' }>;

export interface ResearchExecutor {
  mode: ResearchMode;
  execute(op: ResearchOp): Promise<string>;
}

export function isResearchOp(op: Operation): op is ResearchOp {
  return op.op === 'webSearch' || op.op === 'readPage';
}

const REFUSALS: Record<Exclude<ResearchMode, 'brave'>, string> = {
  none:
    'Research is switched off in Settings, so this request was not run. Tell the user they can ' +
    'enable web research in Settings if they want you to look things up.',
  model:
    'This request was not run — research here works through your own built-in web search, ' +
    'not through Otto. Use your built-in search directly, or answer from what you know.',
};

export function createResearchExecutor(): ResearchExecutor {
  const config = readResearchConfig();
  const provider = createSearchProvider(config);
  const mode: ResearchMode = config.provider;

  return {
    mode,
    async execute(op) {
      if (mode !== 'brave' || !provider) {
        return REFUSALS[mode === 'brave' ? 'none' : mode];
      }
      try {
        if (op.op === 'webSearch') {
          const results = await provider.search(op.query);
          return JSON.stringify({ query: op.query, results });
        }
        const page = await readPage(op.url);
        return JSON.stringify(page);
      } catch (error) {
        return JSON.stringify({
          error: `That request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        });
      }
    },
  };
}
