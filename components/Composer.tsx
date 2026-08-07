'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Draft {
  op: 'draftAction';
  kind: 'sendMessage' | 'deleteRecord' | 'deleteSurface';
  description: string;
  payload: Record<string, string | number | null>;
}

interface OperatorResponse {
  reply?: string;
  createdSurfaceIds?: string[];
  operations?: unknown[];
  appliedCount?: number;
  batchId?: string;
  drafts?: Draft[];
  error?: string;
}

interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

// 6 exchanges of context; older turns fall off the front
const MAX_HISTORY_TURNS = 12;

/**
 * The persistent "Summon" composer — Otto's main input. Describing a need
 * here reshapes the app in place: the message goes to the operator, the
 * reply is shown with an Undo for what was applied, and anything
 * destructive or outbound waits below as a draft until it's approved.
 *
 * It also carries the conversation: recent turns are kept here (the
 * composer stays mounted across navigation) and sent with each request, so
 * "add one more" means something. Assistant turns are stored as the
 * validated operations JSON — context for the model AND a format anchor
 * for smaller ones. A full page reload starts a fresh conversation.
 */
export default function Composer() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryTurn[]>([]);
  const [note, setNote] = useState<{ kind: 'reply' | 'error'; text: string } | undefined>();
  const [undoableBatch, setUndoableBatch] = useState<string | undefined>();
  const [drafts, setDrafts] = useState<Draft[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const message = value.trim();
    if (!message || busy) {
      return;
    }
    setBusy(true);
    setNote(undefined);
    setDrafts([]);
    setUndoableBatch(undefined);
    try {
      const res = await fetch('/api/operator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      const data: OperatorResponse = await res.json();
      if (!res.ok || data.error) {
        setNote({ kind: 'error', text: data.error ?? 'Something went wrong.' });
        return;
      }
      setHistory((prev) =>
        [
          ...prev,
          { role: 'user' as const, content: message },
          {
            role: 'assistant' as const,
            content: JSON.stringify(data.operations ?? [{ op: 'answer', text: data.reply ?? 'Done.' }]),
          },
        ].slice(-MAX_HISTORY_TURNS),
      );
      setNote({ kind: 'reply', text: data.reply ?? 'Done.' });
      setDrafts(data.drafts ?? []);
      if ((data.appliedCount ?? 0) > 0 && data.batchId) {
        setUndoableBatch(data.batchId);
      }
      setValue('');
      const created = data.createdSurfaceIds?.[0];
      if (created) {
        router.push(`/surface/${created}`);
      }
      router.refresh();
    } catch {
      setNote({ kind: 'error', text: 'Could not reach Otto. Is the server still running?' });
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!undoableBatch || busy) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/undo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ batchId: undoableBatch }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setNote({ kind: 'error', text: data.error ?? 'Could not undo that.' });
        return;
      }
      setNote({ kind: 'reply', text: 'Undone — everything is back the way it was.' });
      setUndoableBatch(undefined);
      router.refresh();
    } catch {
      setNote({ kind: 'error', text: 'Could not reach Otto. Is the server still running?' });
    } finally {
      setBusy(false);
    }
  }

  async function resolveDraft(draft: Draft, approved: boolean) {
    if (busy) {
      return;
    }
    if (!approved) {
      setDrafts((prev) => prev.filter((d) => d !== draft));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/operator/apply-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setNote({ kind: 'error', text: data.error ?? 'Could not apply that.' });
        return;
      }
      setNote({ kind: 'reply', text: data.reply ?? 'Done.' });
      setUndoableBatch(draft.kind === 'sendMessage' ? undefined : data.batchId);
      setDrafts((prev) => prev.filter((d) => d !== draft));
      router.refresh();
    } catch {
      setNote({ kind: 'error', text: 'Could not reach Otto. Is the server still running?' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sticky bottom-0 border-t border-line bg-cream pt-3 pb-5">
      <p className="pb-3 text-center text-xs text-faint">
        Home floats up what needs you now. Library holds everything. Or just ask below.
      </p>
      {note && (
        <div
          className={`mb-3 flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm whitespace-pre-line ${
            note.kind === 'error'
              ? 'border-attention-line bg-attention-bg text-attention-ink'
              : 'border-line bg-card'
          }`}
        >
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-accent text-[10px] font-bold text-white">
            O
          </span>
          <span className="flex-1">
            {note.text}
            {note.kind === 'error' && note.text.includes('Settings') && (
              <>
                {' '}
                <Link href="/settings" className="font-semibold underline">
                  Open Settings
                </Link>
              </>
            )}
          </span>
          {note.kind === 'reply' && undoableBatch && (
            <button
              onClick={undo}
              disabled={busy}
              className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-faint hover:text-ink disabled:opacity-50"
            >
              Undo
            </button>
          )}
        </div>
      )}
      {drafts.map((draft, index) => (
        <div
          key={index}
          className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-attention-line bg-attention-bg px-4 py-3"
        >
          <p className="text-sm text-attention-ink">
            <span className="font-semibold">Needs your OK: </span>
            {draft.description}
          </p>
          <span className="flex shrink-0 gap-2">
            <button
              onClick={() => resolveDraft(draft, false)}
              disabled={busy}
              className="rounded-full border border-attention-line px-3.5 py-1.5 text-xs font-semibold text-attention-ink hover:bg-attention-line/40 disabled:opacity-50"
            >
              Dismiss
            </button>
            <button
              onClick={() => resolveDraft(draft, true)}
              disabled={busy}
              className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              Approve
            </button>
          </span>
        </div>
      ))}
      <form onSubmit={submit} className="flex items-center gap-2.5">
        <input
          className="w-full rounded-full border border-line bg-card px-5 py-3 text-sm placeholder-faint focus:border-faint focus:outline-none disabled:opacity-60"
          placeholder={busy ? 'Otto is thinking…' : 'Ask Otto for anything…'}
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={busy}
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-white hover:bg-accent-deep disabled:opacity-60"
        >
          {busy ? (
            <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
