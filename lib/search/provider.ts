/**
 * SearchProvider is Otto's third extension point, alongside LLMProvider
 * (lib/llm/provider.ts) and Store (lib/store/store.ts). It powers the
 * model's `webSearch` request operation — and nothing else. The model
 * never calls a provider itself; the operator does, only when the user
 * has switched research on in Settings.
 *
 * To add a provider: one adapter file next to brave.ts (plain fetch, no
 * SDKs), a case in lib/search/index.ts, an option in Settings. Keep
 * adapters read-only — a SearchProvider must never mutate anything.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string): Promise<SearchResult[]>;
}
