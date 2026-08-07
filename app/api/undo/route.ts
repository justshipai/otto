import { z } from 'zod';
import { undoBatch } from '@/lib/operator/undo';
import { getStore } from '@/lib/store';

/**
 * Undo the most recent change batch. Only the latest batch is undoable —
 * replaying older inverses over newer changes could corrupt state, and
 * the history page stays honest instead.
 */
export async function POST(request: Request) {
  const parsed = z.object({ batchId: z.string().min(1) }).safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: 'Nothing to undo.' }, { status: 400 });
  }

  const store = await getStore();
  const [latest] = await store.listChanges(1);
  if (!latest || latest.batchId !== parsed.data.batchId) {
    return Response.json(
      { error: 'Something changed since — only the most recent change can be undone.' },
      { status: 409 },
    );
  }

  try {
    const result = await undoBatch(store, parsed.data.batchId);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not undo that.' },
      { status: 409 },
    );
  }
}
