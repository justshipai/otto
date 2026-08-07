import type { LLMConfig } from '@/lib/config';
import type { LLMProvider, LLMRequest } from '@/lib/llm/provider';

/**
 * Adapter for the Anthropic API (Claude models), using native tool calling
 * for structured output: we define a single tool whose input schema is the
 * operation list, and force the model to call it, so the response is
 * already shaped JSON. The operator still re-validates it with zod like
 * any other adapter's output.
 *
 * Plain fetch on purpose — see lib/llm/provider.ts.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 120_000;

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  #config: LLMConfig;

  constructor(config: LLMConfig) {
    this.#config = config;
  }

  async complete(request: LLMRequest): Promise<string> {
    if (!this.#config.apiKey) {
      throw new Error('No API key configured. Add one in Settings.');
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.#config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.#config.model,
        max_tokens: 8192,
        system: request.system,
        messages: request.messages,
        tools: [
          {
            name: 'emit_operations',
            description:
              'Emit the list of operations to apply to the workspace in response to the user.',
            input_schema: {
              type: 'object',
              properties: { operations: request.operationsJsonSchema },
              required: ['operations'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'emit_operations' },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      content?: { type: string; input?: { operations?: unknown }; text?: string }[];
    };

    const toolUse = data.content?.find((block) => block.type === 'tool_use');
    if (toolUse?.input?.operations !== undefined) {
      return JSON.stringify(toolUse.input.operations);
    }

    // the model ignored the forced tool (rare); hand back whatever text it
    // produced and let validation deal with it
    const text = data.content?.find((block) => block.type === 'text')?.text;
    if (text) {
      return text;
    }
    throw new Error('Anthropic API returned no usable content');
  }
}
