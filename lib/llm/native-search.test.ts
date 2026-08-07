import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnthropicProvider } from '@/lib/llm/anthropic';
import { OpenAICompatibleProvider } from '@/lib/llm/openai-compatible';
import type { LLMRequest } from '@/lib/llm/provider';

function request(nativeWebSearch: boolean): LLMRequest {
  return {
    system: 'system prompt',
    messages: [{ role: 'user', content: 'hi' }],
    operationsJsonSchema: { type: 'array' },
    nativeWebSearch,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('native web search — anthropic adapter', () => {
  it('adds the web_search server tool and relaxes tool_choice when enabled', async () => {
    const calls: { body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
      calls.push({ body: JSON.parse(String(init.body)) });
      return jsonResponse({ content: [{ type: 'tool_use', name: 'emit_operations', input: { operations: [] } }] });
    });
    const provider = new AnthropicProvider({ provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'k' });

    await provider.complete(request(true));

    const body = calls[0].body as { tools: { type?: string; name: string }[]; tool_choice: { type: string }; system: string };
    expect(body.tools.map((t) => t.name)).toEqual(['emit_operations', 'web_search']);
    expect(body.tools[1].type).toBe('web_search_20250305');
    expect(body.tool_choice).toEqual({ type: 'auto' });
    expect(body.system).toContain('finish by calling emit_operations');
  });

  it('keeps the forced tool and no search tool when disabled', async () => {
    const calls: { body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
      calls.push({ body: JSON.parse(String(init.body)) });
      return jsonResponse({ content: [{ type: 'tool_use', name: 'emit_operations', input: { operations: [] } }] });
    });
    const provider = new AnthropicProvider({ provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'k' });

    await provider.complete(request(false));

    const body = calls[0].body as { tools: { name: string }[]; tool_choice: { type: string } };
    expect(body.tools.map((t) => t.name)).toEqual(['emit_operations']);
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'emit_operations' });
  });

  it('picks emit_operations even when search blocks precede it', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse({
        content: [
          { type: 'server_tool_use', name: 'web_search', input: { query: 'x' } },
          { type: 'web_search_tool_result', content: [] },
          { type: 'text', text: 'Based on my search…' },
          { type: 'tool_use', name: 'emit_operations', input: { operations: [{ op: 'answer', text: 'found it' }] } },
        ],
      }),
    );
    const provider = new AnthropicProvider({ provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'k' });

    const raw = await provider.complete(request(true));

    expect(JSON.parse(raw)).toEqual([{ op: 'answer', text: 'found it' }]);
  });
});

describe('native web search — openai-compatible adapter', () => {
  it('sends web_search_options when enabled', async () => {
    const calls: { body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
      calls.push({ body: JSON.parse(String(init.body)) });
      return jsonResponse({ choices: [{ message: { content: '[]' } }] });
    });
    const provider = new OpenAICompatibleProvider({
      provider: 'openai-compatible',
      model: 'gpt-5.2',
      apiKey: 'k',
      baseUrl: 'https://api.openai.com/v1',
    });

    await provider.complete(request(true));

    expect(calls[0].body.web_search_options).toEqual({});
  });

  it('retries once without web_search_options when the server rejects it', async () => {
    const calls: { body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push({ body });
      if ('web_search_options' in body) {
        return jsonResponse({ error: { message: 'Unknown parameter: web_search_options' } }, 400);
      }
      return jsonResponse({ choices: [{ message: { content: '[]' } }] });
    });
    const provider = new OpenAICompatibleProvider({
      provider: 'openai-compatible',
      model: 'llama3.3',
      baseUrl: 'http://localhost:11434/v1',
    });

    const raw = await provider.complete(request(true));

    expect(calls).toHaveLength(2);
    expect('web_search_options' in calls[1].body).toBe(false);
    expect(raw).toBe('[]');
  });

  it('surfaces unrelated 4xx errors instead of retrying', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({ error: { message: 'invalid api key' } }, 401));
    const provider = new OpenAICompatibleProvider({
      provider: 'openai-compatible',
      model: 'gpt-5.2',
      apiKey: 'bad',
      baseUrl: 'https://api.openai.com/v1',
    });

    await expect(provider.complete(request(true))).rejects.toThrow(/401/);
  });
});
