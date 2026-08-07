import { BraveSearchProvider } from '@/lib/search/brave';
import type { ResearchConfig } from '@/lib/config';
import type { SearchProvider } from '@/lib/search/provider';

/**
 * The one place a concrete search adapter is chosen. `undefined` means Otto
 * itself does no searching — either research is off (the default) or the
 * 'model' mode is on, where the LLM provider's built-in search does the
 * looking-up inside the completion instead.
 */
export function createSearchProvider(config: ResearchConfig): SearchProvider | undefined {
  switch (config.provider) {
    case 'brave':
      return new BraveSearchProvider(config);
    case 'model':
    case 'none':
      return undefined;
  }
}
