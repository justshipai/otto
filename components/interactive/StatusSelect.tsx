'use client';

import { useState } from 'react';
import StatusPill from '@/components/surface-views/StatusPill';
import { useApply } from '@/components/interactive/useApply';

/**
 * A status pill you can tap: looks like the read-only pill, but a native
 * <select> sits invisibly on top, so changing a value (or moving a board
 * card between columns) is one tap. The change is an ordinary updateRecord
 * operation — validated, logged, undoable.
 */
export default function StatusSelect({
  recordId,
  fieldKey,
  value,
  options,
}: {
  recordId: string;
  fieldKey: string;
  value: string | null;
  options: string[];
}) {
  const { apply } = useApply();
  const [pending, setPending] = useState<string | undefined>();
  const [lastValue, setLastValue] = useState(value);

  // drop the optimistic value once the server confirms (value prop changes)
  if (value !== lastValue) {
    setLastValue(value);
    setPending(undefined);
  }

  const shown = pending ?? value;

  async function change(next: string) {
    setPending(next);
    const ok = await apply([{ op: 'updateRecord', recordId, values: { [fieldKey]: next } }]);
    if (!ok) {
      setPending(undefined);
    }
  }

  return (
    <label className="relative inline-block cursor-pointer">
      <StatusPill label={shown ?? '—'} />
      <select
        className="absolute inset-0 cursor-pointer opacity-0"
        value={shown ?? ''}
        aria-label="Change status"
        onChange={(e) => change(e.target.value)}
      >
        {shown === null && <option value="" disabled hidden />}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
