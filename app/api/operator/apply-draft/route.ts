import { z } from 'zod';
import { draftActionOpSchema } from '@/lib/core/operations';
import { applyDraft } from '@/lib/operator/drafts';
import { getStore } from '@/lib/store';

/**
 * The approve button. The draft is re-validated against the operation
 * schema here — the client is not trusted to echo back what the model
 * proposed — and then applied with a change-log inverse.
 */
export async function POST(request: Request) {
  const parsed = z.object({ draft: draftActionOpSchema }).safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "That draft doesn't look right — ask Otto to redo it." }, { status: 400 });
  }

  const store = await getStore();
  try {
    const result = await applyDraft(store, parsed.data.draft);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not apply that.' },
      { status: 409 },
    );
  }
}
