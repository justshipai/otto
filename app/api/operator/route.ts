import { z } from 'zod';
import { readLLMConfig } from '@/lib/config';
import { createProvider } from '@/lib/llm';
import { runOperator } from '@/lib/operator';
import { getStore } from '@/lib/store';

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  // recent conversation, held by the client; capped so a stuck client
  // can't grow prompts without bound
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(20000),
      }),
    )
    .max(12)
    .optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: 'Say something first.' }, { status: 400 });
  }

  const store = await getStore();
  const provider = createProvider(readLLMConfig());

  try {
    const result = await runOperator(store, provider, parsed.data.message, parsed.data.history);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Something went wrong talking to the model.' },
      { status: 502 },
    );
  }
}
