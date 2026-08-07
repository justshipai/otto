'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function HistoryUndoButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function undo() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch('/api/undo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Could not undo that.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach Otto.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-attention-ink">{error}</span>}
      <button
        onClick={undo}
        disabled={busy}
        className="rounded-full border border-line px-3.5 py-1 text-xs font-semibold text-faint hover:text-ink disabled:opacity-50"
      >
        {busy ? 'Undoing…' : 'Undo'}
      </button>
    </span>
  );
}
