import HistoryUndoButton from '@/app/(shell)/history/HistoryUndoButton';
import { getStore } from '@/lib/store';
import type { ChangeLogEntry } from '@/lib/core/operations';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'History · Otto' };

interface Batch {
  batchId: string;
  entries: ChangeLogEntry[];
}

// entries arrive newest-first; consecutive entries with one batchId are one change
function groupIntoBatches(entries: ChangeLogEntry[]): Batch[] {
  const batches: Batch[] = [];
  for (const entry of entries) {
    const current = batches[batches.length - 1];
    if (current && current.batchId === entry.batchId) {
      current.entries.push(entry);
    } else {
      batches.push({ batchId: entry.batchId, entries: [entry] });
    }
  }
  return batches;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Every change Otto has ever applied, newest first, in plain language —
 * the visible half of "trust through visibility and undo". Only the most
 * recent change can be undone (older inverses may no longer apply
 * cleanly); undoing writes its own entry here rather than erasing
 * anything, so the log never lies.
 */
export default async function HistoryPage() {
  const store = await getStore();
  const batches = groupIntoBatches(await store.listChanges(100));

  return (
    <div>
      <h1 className="pb-1 text-2xl font-bold tracking-tight">History</h1>
      <p className="pb-6 text-sm text-faint">
        Everything Otto has changed, newest first. Nothing here is ever edited or deleted.
      </p>
      {batches.length === 0 && <p className="py-10 text-center text-sm text-faint">No changes yet.</p>}
      <div className="flex flex-col gap-3">
        {batches.map((batch, index) => (
          <div key={batch.batchId} className="rounded-2xl border border-line bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-3 pb-1.5">
              <span className="text-xs text-faint">{formatTime(batch.entries[0].createdAt)}</span>
              {index === 0 && <HistoryUndoButton batchId={batch.batchId} />}
            </div>
            <ul className="flex flex-col gap-1">
              {batch.entries.map((entry) => (
                <li key={entry.id} className="text-sm">
                  {entry.summary}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
