'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface OperatorResponse {
  reply?: string;
  createdSurfaceIds?: string[];
  error?: string;
}

/**
 * The persistent "Summon" composer — Otto's main input. Describing a need
 * here reshapes the app in place: the message goes to the operator, the
 * reply is shown, and the pages re-read fresh data.
 */
export default function Composer() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'reply' | 'error'; text: string } | undefined>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const message = value.trim();
    if (!message || busy) {
      return;
    }
    setBusy(true);
    setNote(undefined);
    try {
      const res = await fetch('/api/operator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data: OperatorResponse = await res.json();
      if (!res.ok || data.error) {
        setNote({ kind: 'error', text: data.error ?? 'Something went wrong.' });
        return;
      }
      setNote({ kind: 'reply', text: data.reply ?? 'Done.' });
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
          <span>
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
        </div>
      )}
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
