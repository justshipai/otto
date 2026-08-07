import { z } from 'zod';
import {
  envOverriddenFields,
  llmConfigSchema,
  readLLMConfig,
  readResearchConfig,
  researchConfigSchema,
  researchEnvOverriddenFields,
  writeLLMConfig,
  writeResearchConfig,
} from '@/lib/config';

/**
 * Read and write the local settings. API keys are write-only through this
 * API: GET reports only whether one is saved, so keys never travel back to
 * the browser.
 */

export async function GET() {
  const llm = readLLMConfig();
  const research = readResearchConfig();
  return Response.json({
    provider: llm.provider,
    model: llm.model,
    baseUrl: llm.baseUrl ?? '',
    hasApiKey: Boolean(llm.apiKey),
    envOverrides: envOverriddenFields(),
    research: {
      provider: research.provider,
      hasApiKey: Boolean(research.apiKey),
      envOverrides: researchEnvOverriddenFields(),
    },
  });
}

const saveSchema = llmConfigSchema.partial().extend({
  provider: llmConfigSchema.shape.provider,
  model: llmConfigSchema.shape.model,
  research: researchConfigSchema.partial().extend({
    provider: researchConfigSchema.shape.provider,
  }).optional(),
});

export async function POST(request: Request) {
  const parsed = saveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const { research, ...llm } = parsed.data;
  writeLLMConfig(llm);
  if (research) {
    writeResearchConfig(research);
  }
  return Response.json({ ok: true });
}
