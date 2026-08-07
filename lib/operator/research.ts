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
 * Results are wrapped with an explicit reminder that web content is
 * untrusted data — but the real defenses are structural: whatever the
 * model concludes, its output still has to pass the operation schema,
 * destructive/outbound ops still become drafts, and everything is undoable.
 */

export type ResearchOp = Extract<Operation, { op: 'webSearch' | 'readPage' }>;

export interface ResearchExecutor {
  enabled: boolean;
  execute(op: ResearchOp): Promise<string>;
}

export function isResearchOp(op: Operation): op is ResearchOp {
  return op.op === 'webSearch' || op.op === 'readPage';
}

const DISABLED_MESSAGE =
  'Research is switched off in Settings, so this request was not run. Tell the user they can ' +
  'enable web research in Settings if they want you to look things up.';

export function createResearchExecutor(): ResearchExecutor {
  const config = readResearchConfig();
  const provider = createSearchProvider(config);
  const enabled = provider !== undefined;

  return {
    enabled,
    async execute(op) {
      if (!enabled) {
        return DISABLED_MESSAGE;
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
