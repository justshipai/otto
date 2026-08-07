import { z } from 'zod';
import { materializeStarter } from '@/lib/store/starters';
import { getStore } from '@/lib/store';

/**
 * First-run only: materialize a starter surface from a chip tap. Needs no
 * LLM key — the point is that Otto works the moment it's cloned. Guarded
 * to an empty workspace; after that, new surfaces come from talking.
 */
export async function POST(request: Request) {
  const parsed = z.object({ starter: z.string().min(1) }).safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: 'Pick one of the examples.' }, { status: 400 });
  }

  const store = await getStore();
  if ((await store.listSurfaces()).length > 0) {
    return Response.json(
      { error: 'The workspace already has surfaces — just ask Otto below instead.' },
      { status: 409 },
    );
  }

  try {
    const surface = await materializeStarter(store, parsed.data.starter);
    return Response.json({ ok: true, surfaceId: surface.id });
  } catch {
    return Response.json({ error: 'Pick one of the examples.' }, { status: 400 });
  }
}
