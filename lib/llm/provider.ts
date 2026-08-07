/**
 * LLMProvider is Otto's model seam and one of its two primary extension
 * points (the other is Store in lib/store/store.ts).
 *
 * The contract is deliberately humble: given a system prompt, a short
 * message history, and the JSON schema of the allowed operations, return
 * the model's attempt at a JSON operation list AS RAW TEXT. That's all.
 *
 * Adapters may fulfil it however their API allows — native tool calling
 * (see anthropic.ts), JSON mode, or a plain text completion (see
 * openai-compatible.ts). Adapters must NOT assume tool calling or JSON
 * mode exists, and must NOT validate or repair output: the operator
 * validates every response against the zod schemas server-side no matter
 * which adapter produced it (lib/llm/validate.ts), so a misbehaving model
 * or adapter can never write anything unchecked.
 *
 * To add a provider: copy the closer of the two shipped adapters into a
 * new file, adjust the HTTP call, and register it in lib/llm/index.ts.
 * Please use plain fetch, not a vendor SDK — it keeps adapters copyable
 * and the dependency tree empty.
 */

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  /** Full system prompt: role, workspace state, and behavioural rules. */
  system: string;
  /** The conversation so far; on a validation retry this includes the failed attempt and the error. */
  messages: LLMMessage[];
  /**
   * JSON Schema for the expected operation list. Adapters with structured
   * output use it natively; plain-text adapters embed it in the prompt.
   */
  operationsJsonSchema: Record<string, unknown>;
}

export interface LLMProvider {
  /** Short human-readable name shown in errors, e.g. "anthropic". */
  readonly name: string;
  /** One completion. Throw on transport/API errors; return raw text otherwise. */
  complete(request: LLMRequest): Promise<string>;
}
