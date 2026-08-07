'use client';

import { useState } from 'react';

/**
 * The persistent "Summon" composer — Otto's main input. Milestone 4 wires
 * it to the operator; until then it explains itself instead of acting.
 */
export default function Composer() {
  const [value, setValue] = useState('');
  const [note, setNote] = useState<string | undefined>();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) {
      return;
    }
    setNote("Otto can't act on this quite yet — the operator arrives in milestone 4. Browse the demo data meanwhile.");
    setValue('');
  }

  return (
    <div className="sticky bottom-0 border-t border-line bg-cream pt-3 pb-5">
      <p className="pb-3 text-center text-xs text-faint">
        Home floats up what needs you now. Library holds everything. Or just ask below.
      </p>
      {note && <p className="pb-2 text-center text-xs text-attention-ink">{note}</p>}
      <form onSubmit={submit} className="flex items-center gap-2.5">
        <input
          className="w-full rounded-full border border-line bg-card px-5 py-3 text-sm placeholder-faint focus:border-faint focus:outline-none"
          placeholder="Ask Otto for anything…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setNote(undefined);
          }}
        />
        <button
          type="submit"
          aria-label="Send"
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-white hover:bg-accent-deep"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  );
}
