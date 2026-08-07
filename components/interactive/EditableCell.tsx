'use client';

import { useState } from 'react';
import { formatFieldValue } from '@/lib/format';
import { useApply } from '@/components/interactive/useApply';
import type { Field, FieldValue } from '@/lib/core/types';

/**
 * A table cell you can click into and edit. Enter or blur commits (as an
 * updateRecord operation), Escape cancels. Numbers and money parse as
 * numbers; clearing a cell stores null.
 */
export default function EditableCell({
  recordId,
  field,
  value,
}: {
  recordId: string;
  field: Field;
  value: FieldValue;
}) {
  const { apply } = useApply();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<FieldValue | undefined>();

  const shown = pending !== undefined ? pending : value;
  const numeric = field.type === 'money' || field.type === 'number';

  async function commit(raw: string) {
    setEditing(false);
    const trimmed = raw.trim();
    let next: FieldValue;
    if (trimmed === '') {
      next = null;
    } else if (numeric) {
      const parsed = Number(trimmed.replace(/[$,]/g, ''));
      if (Number.isNaN(parsed)) {
        return;
      }
      next = parsed;
    } else {
      next = trimmed;
    }
    if (next === value) {
      return;
    }
    setPending(next);
    const ok = await apply([{ op: 'updateRecord', recordId, values: { [field.key]: next } }]);
    if (!ok) {
      setPending(undefined);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={field.type === 'date' ? 'date' : numeric ? 'number' : 'text'}
        step={numeric ? 'any' : undefined}
        defaultValue={shown === null ? '' : String(shown)}
        className="w-full min-w-24 rounded-md border border-faint bg-card px-2 py-1 text-sm focus:outline-none"
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
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
      className={`block w-full cursor-text rounded-md px-0.5 py-0.5 text-left text-sm hover:bg-cream ${numeric ? 'text-right tabular-nums' : ''}`}
    >
      {formatFieldValue(field, shown)}
    </button>
  );
}
