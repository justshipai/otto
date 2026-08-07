import type { LLMConfig } from '@/lib/config';
import type { LLMProvider, LLMRequest } from '@/lib/llm/provider';

/**
 * Adapter for anything speaking the OpenAI chat-completions API, selected
 * by base URL: OpenAI itself, Groq, OpenRouter, and local models via
 * Ollama (http://localhost:11434/v1) or LM Studio (http://localhost:1234/v1).
 *
 * It deliberately assumes NOTHING beyond plain text chat: no tool calling,
 * no JSON mode, no vendor extensions — many local models support none of
 * them. The operation JSON schema is embedded in the system prompt and the
 * model is asked to reply with only JSON; lib/llm/validate.ts handles
 * imperfect replies (fenced code blocks, prose around the JSON, one retry
 * with the validation error).
 *
 * Plain fetch on purpose — see lib/llm/provider.ts.
 */

const TIMEOUT_MS = 120_000;

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = 'openai-compatible';
  #config: LLMConfig;

  constructor(config: LLMConfig) {
    this.#config = config;
  }

  async complete(request: LLMRequest): Promise<string> {
    if (!this.#config.baseUrl) {
      throw new Error('No base URL configured. Add one in Settings (see examples there).');
    }

    const system = [
      request.system,
      'Respond with ONLY a JSON array of operations matching this JSON Schema — no prose, no code fences:',
      JSON.stringify(request.operationsJsonSchema),
    ].join('\n\n');

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    // local servers like Ollama don't need a key
    if (this.#config.apiKey) {
      headers.authorization = `Bearer ${this.#config.apiKey}`;
    }

    const url = `${this.#config.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers,
      body: JSON.stringify({
        model: this.#config.model,
        messages: [{ role: 'system', content: system }, ...request.messages],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${url} returned ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('Model returned an empty response');
    }
    return content;
  }
}
