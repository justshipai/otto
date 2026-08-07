import { operationListJsonSchema, type DraftActionOp, type Operation } from '@/lib/core/operations';
import { requestOperations } from '@/lib/llm/validate';
import { applyOperations } from '@/lib/operator/apply';
import { buildSystemPrompt, type WorkspaceSurface } from '@/lib/operator/prompt';
import type { LLMMessage, LLMProvider } from '@/lib/llm/provider';
import type { Store } from '@/lib/store/store';

/**
 * The operator: one user message in, validated operations applied, one
 * plain-language reply out. This is the ONLY path from a model to the
 * user's data, and everything that arrives here has already passed the
 * zod gate in lib/llm/validate.ts.
 */

export interface OperatorResult {
  reply: string;
  createdSurfaceIds: string[];
  appliedCount: number;
  /** the batch every applied change was logged under — what Undo targets */
  batchId: string;
  /** proposed destructive/outbound actions awaiting approval */
  drafts: DraftActionOp[];
  /** the validated operations, so the client can carry them as conversation history */
  operations: Operation[];
  /** true when the model couldn't produce valid operations and we fell back to asking the user to rephrase */
  fallback: boolean;
}

export async function runOperator(
  store: Store,
  provider: LLMProvider,
  userMessage: string,
  history: LLMMessage[] = [],
): Promise<OperatorResult> {
  const surfaces = await store.listSurfaces();
  const workspace: WorkspaceSurface[] = await Promise.all(
    surfaces.map(async (surface) => ({ surface, records: await store.listRecords(surface.id) })),
  );

  const { operations, fallback } = await requestOperations(provider, {
    system: buildSystemPrompt(workspace, new Date().toISOString().slice(0, 10)),
    // prior turns give the model conversational memory ("add one more",
    // "actually make it a board"); the workspace snapshot alone can't
    messages: [...history, { role: 'user', content: userMessage }],
    operationsJsonSchema: operationListJsonSchema(),
  });

  const batchId = crypto.randomUUID();
  const applied = await applyOperations(store, operations, batchId);

  const replyLines = [...applied.replyParts];
  if (applied.skipped.length > 0) {
    replyLines.push(`I held off on some of it: ${applied.skipped.join('; ')}.`);
  }
  if (applied.drafts.length > 0 && replyLines.length === 0) {
    replyLines.push('Here’s what I’d like to do — it needs your say-so first.');
  }

  return {
    reply: replyLines.join('\n') || 'Done.',
    createdSurfaceIds: applied.createdSurfaceIds,
    appliedCount: applied.appliedCount,
    batchId,
    drafts: applied.drafts,
    operations,
    fallback,
  };
}
