import { operationListJsonSchema } from '@/lib/core/operations';
import { readLLMConfig } from '@/lib/config';
import { createProvider } from '@/lib/llm';
import { requestOperations } from '@/lib/llm/validate';

/**
 * Round-trip test of the SAVED settings: calls the configured model through
 * the full pipeline (adapter → JSON extraction → zod validation → retry),
 * asking for a single 'answer' operation. Proves connectivity, auth, and
 * that the model can follow the operation format — the same path real
 * requests will take.
 */

export async function POST() {
  const config = readLLMConfig();
  const provider = createProvider(config);

  try {
    const result = await requestOperations(provider, {
      system:
        'You are Otto, a personal operator. This is a connection test. ' +
        'Reply with exactly one operation: an "answer" op with a one-sentence friendly hello that names the model you are.',
      messages: [{ role: 'user', content: 'Connection test — say hello.' }],
      operationsJsonSchema: operationListJsonSchema(),
    });

    const answer = result.operations.find((op) => op.op === 'answer');
    if (result.fallback || !answer) {
      return Response.json({
        ok: false,
        error:
          'Connected, but the model could not produce a valid operation even after a retry. ' +
          'It may be too small to follow the format — try a different model.',
      });
    }
    return Response.json({
      ok: true,
      message: answer.text,
      attempts: result.attempts,
      provider: provider.name,
      model: config.model,
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
