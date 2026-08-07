'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Client half of the UI write path: posts constrained operations to
 * /api/apply (same schema, same change log, same undo as the model's
 * changes) and refreshes server data. Returns false on failure so
 * callers can drop optimistic state.
 */
export function useApply() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function apply(operations: unknown[]): Promise<boolean> {
    if (busy) {
      return false;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ operations }),
      });
      router.refresh();
      return res.ok;
    } catch {
      router.refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { apply, busy };
}
