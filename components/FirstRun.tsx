'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The empty-workspace welcome: one open question and four cross-domain
 * example chips. A chip materializes a real starter surface server-side
 * (no API key needed yet) whose automation has something to say right
 * away — the first proactive nudge. Free text goes through the composer
 * below, like everything else forever after.
 */
export default function FirstRun({ chips }: { chips: { key: string; label: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  async function pick(key: string) {
    if (busy) {
      return;
    }
    setBusy(key);
    setError(undefined);
    try {
      const res = await fetch('/api/starter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ starter: key }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong.');
        return;
      }
      router.push(`/surface/${data.surfaceId}`);
      router.refresh();
    } catch {
      setError('Something went wrong.');
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="mx-auto max-w-md pt-10 pb-6">
      <h1 className="text-2xl font-bold tracking-tight">
        What&rsquo;s something you&rsquo;re juggling right now?
      </h1>
      <p className="pt-2 pb-8 text-sm text-faint">Work or life. Otto will build you something to run it.</p>
      <div className="flex flex-col gap-3">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            disabled={busy !== undefined}
            onClick={() => pick(chip.key)}
            className="rounded-2xl border border-line bg-card px-5 py-3.5 text-left text-sm font-medium transition-shadow hover:shadow-sm disabled:opacity-60"
          >
            {busy === chip.key ? 'Setting it up…' : chip.label}
          </button>
        ))}
      </div>
      {error && <p className="pt-4 text-sm text-attention-ink">{error}</p>}
      <p className="pt-6 text-center text-xs text-faint">…or tell Otto in your own words below.</p>
    </div>
  );
}
