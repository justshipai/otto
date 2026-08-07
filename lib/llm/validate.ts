import { z } from 'zod';
import { operationListSchema, type OperationList } from '@/lib/core/operations';
import { extractJsonArray } from '@/lib/llm/extract-json';
import type { LLMProvider, LLMRequest } from '@/lib/llm/provider';

/**
 * The validation gate every model response passes through, no matter which
 * adapter produced it:
 *
 *   1. ask the provider for operations
 *   2. locate JSON in the reply and validate it against the zod schemas
 *   3. on failure, retry ONCE with the validation error quoted back
 *   4. on failure again, fall back to a plain 'answer' op asking the user
 *      to rephrase — never apply anything that didn't validate
 *
 * This is what makes Otto provider-agnostic in practice: a plain-text
 * local model and a tool-calling frontier model both end here, and only
 * schema-valid operations come out.
 */

export interface OperationRequestResult {
  operations: OperationList;
  /** true when validation failed twice and `operations` is the fallback answer */
  fallback: boolean;
  attempts: number;
}

function tryParse(raw: string): { operations?: OperationList; error?: string } {
  const json = extractJsonArray(raw);
  if (json === undefined) {
    return { error: 'No JSON array of operations found in the response.' };
  }
  const parsed = operationListSchema.safeParse(json);
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error).slice(0, 1000) };
  }
  return { operations: parsed.data };
}

export async function requestOperations(
  provider: LLMProvider,
  request: LLMRequest,
): Promise<OperationRequestResult> {
  const first = await provider.complete(request);
  const attempt1 = tryParse(first);
  if (attempt1.operations) {
    return { operations: attempt1.operations, fallback: false, attempts: 1 };
  }

  const retry: LLMRequest = {
    ...request,
    messages: [
      ...request.messages,
      { role: 'assistant', content: first },
      {
        role: 'user',
        content:
          `That response was not valid. ${attempt1.error}\n\n` +
          'Reply again with ONLY a JSON array of operations matching the schema — no prose, no code fences.',
      },
    ],
  };
  const second = await provider.complete(retry);
  const attempt2 = tryParse(second);
  if (attempt2.operations) {
    return { operations: attempt2.operations, fallback: false, attempts: 2 };
  }

  return {
    operations: [
      {
        op: 'answer',
        text: "I couldn't turn that into a change I'm confident about. Could you say it a little differently — for example, name the thing you want to track and what you want to know about each item?",
      },
    ],
    fallback: true,
    attempts: 2,
  };
}
