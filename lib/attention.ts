import type { Surface } from '@/lib/core/types';
import type { Store } from '@/lib/store/store';

/**
 * What deserves the top of Home. Milestone 7's scheduler evaluates enabled
 * automations here (e.g. "a due date passed") — until then, nothing needs
 * attention and Home simply doesn't render the section.
 */
export interface AttentionItem {
  surface: Surface;
  message: string;
}

export async function getAttentionItems(_store: Store): Promise<AttentionItem[]> {
  return [];
}
