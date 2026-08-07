import { BraveSearchProvider } from '@/lib/search/brave';
import type { ResearchConfig } from '@/lib/config';
import type { SearchProvider } from '@/lib/search/provider';

/**
 * The one place a concrete search adapter is chosen. `undefined` means
 * research is off (the default) — the operator then refuses webSearch and
 * readPage requests and tells the model to say so.
 */
export function createSearchProvider(config: ResearchConfig): SearchProvider | undefined {
  switch (config.provider) {
    case 'brave':
      return new BraveSearchProvider(config);
    case 'none':
      return undefined;
  }
}
