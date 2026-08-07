import type { LLMConfig } from '@/lib/config';
import { AnthropicProvider } from '@/lib/llm/anthropic';
import { OpenAICompatibleProvider } from '@/lib/llm/openai-compatible';
import type { LLMProvider } from '@/lib/llm/provider';

/**
 * The one place a concrete LLM adapter is chosen. Adding a provider:
 * write one adapter file next to the two shipped ones, add a case here,
 * and add the option to the Settings screen. Nothing else changes.
 */
export function createProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config);
  }
}
