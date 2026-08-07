import type { ResearchConfig } from '@/lib/config';
import type { SearchProvider, SearchResult } from '@/lib/search/provider';

/**
 * Brave Search API adapter — a free-tier key from brave.com/search/api
 * is enough. Plain fetch on purpose, like every Otto adapter.
 */

// overridable so tests can point at a local mock; real use never sets this
const API_URL = process.env.OTTO_BRAVE_API_URL ?? 'https://api.search.brave.com/res/v1/web/search';
const TIMEOUT_MS = 15_000;
const MAX_RESULTS = 6;

export class BraveSearchProvider implements SearchProvider {
  readonly name = 'brave';
  #config: ResearchConfig;

  constructor(config: ResearchConfig) {
    this.#config = config;
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!this.#config.apiKey) {
      throw new Error('Brave Search needs an API key — add one in Settings.');
    }

    const url = `${API_URL}?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept: 'application/json',
        'x-subscription-token': this.#config.apiKey,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Brave Search error ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      web?: { results?: { title?: string; url?: string; description?: string }[] };
    };
    return (data.web?.results ?? [])
      .filter((r) => r.url && r.title)
      .slice(0, MAX_RESULTS)
      .map((r) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.description ?? '',
      }));
  }
}
