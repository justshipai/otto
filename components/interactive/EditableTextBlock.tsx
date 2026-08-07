'use client';

import { useState } from 'react';
import { useApply } from '@/components/interactive/useApply';

/**
 * A block of prose you can click into and edit (doc section bodies).
 * Blur commits as an updateRecord operation; Escape cancels.
 */
export default function EditableTextBlock({
  recordId,
  fieldKey,
  value,
  placeholder,
}: {
  recordId: string;
  fieldKey: string;
  value: string | null;
  placeholder: string;
}) {
  const { apply } = useApply();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<string | null | undefined>();

  const shown = pending !== undefined ? pending : value;

  async function commit(raw: string) {
    setEditing(false);
    const next = raw.trim() === '' ? null : raw;
    if (next === value) {
      return;
    }
    setPending(next);
    const ok = await apply([{ op: 'updateRecord', recordId, values: { [fieldKey]: next } }]);
    if (!ok) {
      setPending(undefined);
    }
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        defaultValue={shown ?? ''}
        rows={Math.max(4, (shown ?? '').split('\n').length + 1)}
        className="w-full rounded-lg border border-faint bg-card px-3 py-2 text-sm leading-relaxed focus:outline-none"
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="block w-full cursor-text rounded-lg text-left text-sm leading-relaxed whitespace-pre-line hover:bg-cream/60"
    >
      {shown ?? <span className="text-faint">{placeholder}</span>}
    </button>
  );
}
