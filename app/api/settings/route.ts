import { z } from 'zod';
import {
  envOverriddenFields,
  llmConfigSchema,
  readLLMConfig,
  writeLLMConfig,
} from '@/lib/config';

/**
 * Read and write the local LLM settings. The API key is write-only through
 * this API: GET reports only whether one is saved, so the key never travels
 * back to the browser.
 */

export async function GET() {
  const config = readLLMConfig();
  return Response.json({
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl ?? '',
    hasApiKey: Boolean(config.apiKey),
    envOverrides: envOverriddenFields(),
  });
}

const saveSchema = llmConfigSchema.partial().extend({
  provider: llmConfigSchema.shape.provider,
  model: llmConfigSchema.shape.model,
});

export async function POST(request: Request) {
  const parsed = saveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  writeLLMConfig(parsed.data);
  return Response.json({ ok: true });
}
