import { z } from 'zod';
import { operationListSchema } from '@/lib/core/operations';
import { applyOperations } from '@/lib/operator/apply';
import { getStore } from '@/lib/store';

/**
 * The write path for the UI's own interactions — tapping a status, editing
 * a cell, pinning a surface. Direct manipulation emits exactly the same
 * constrained operations the model emits, validated by the same schema and
 * logged with the same inverses: one write path, whoever the actor is.
 *
 * draftAction is rejected here: approvals have their own endpoint, and
 * nothing destructive or outbound rides in through this one.
 */
export async function POST(request: Request) {
  const parsed = z.object({ operations: operationListSchema }).safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "That change doesn't look right." }, { status: 400 });
  }
  if (parsed.data.operations.some((op) => op.op === 'draftAction' || op.op === 'answer')) {
    return Response.json({ error: 'Only direct data changes can be applied here.' }, { status: 400 });
  }

  const store = await getStore();
  const batchId = crypto.randomUUID();
  const result = await applyOperations(store, parsed.data.operations, batchId);

  if (result.appliedCount === 0) {
    return Response.json(
      { error: result.skipped[0] ?? 'Nothing changed — it may have moved on since.' },
      { status: 409 },
    );
  }
  return Response.json({ ok: true, batchId, appliedCount: result.appliedCount });
}
